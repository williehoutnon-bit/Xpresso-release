import { supabase, supabaseAdmin, supabaseAuthService, supabaseDbService } from './supabaseService';
import { dbService } from './dbService';
import { messagingService } from './messagingService';

export let cachedCurrentUser: any = null;
const profileCache = new Map<string, { time: number; data: any }>();
const CACHE_TTL = 60000; // 60 seconds

export const authService = {
  updateProfileCacheEntry(userId: string, data: any) {
    profileCache.set(userId, { time: Date.now(), data });
  },

  async signup(email: string, pass: string, nameData: { surname: string, middleName: string, lastName: string }, role: string = 'student', extraData: any = {}) {
    const fullName = `${nameData.surname} ${nameData.middleName ? nameData.middleName + ' ' : ''}${nameData.lastName}`.trim();

    let loginId = email ? email.trim() : '';
    if (!loginId && extraData.whatsappContact) {
      let phone = extraData.whatsappContact.trim().replace(/[^\d+]/g, '');
      if (phone.startsWith('0') && phone.length === 10) {
        phone = '256' + phone.substring(1);
      }
      const absoluteDigits = phone.replace(/\D/g, '');
      if (absoluteDigits.length >= 7) {
        loginId = `${absoluteDigits}@exup.internal`;
      }
    }

    if (!loginId) {
      throw new Error('Either an email or phone number is required for signup.');
    }

    try {
      const user = await supabaseAuthService.register(loginId, pass, fullName);
      if (!user) throw new Error("Registration failed");
      
      const uidSuffix = user.id.slice(-5).toUpperCase();
      const exupCode = `exup-a${uidSuffix}`;

      const profileData = {
        user_id: user.id,
        surname: nameData.surname,
        middle_name: nameData.middleName,
        last_name: nameData.lastName,
        role: role,
        age: extraData.age ? parseInt(extraData.age, 10) : null,
        school: extraData.school || '',
        district: extraData.district || '',
        country: extraData.country || 'Uganda',
        grade_class: extraData.studentClass || '',
        exup_code: exupCode,
        student_nin: extraData.studentNIN || null,
        student_lin: extraData.studentLIN || null,
        parent_nin: extraData.parentNIN || null,
        student_contact: null,
        parent_contact: extraData.parentContact || null,
        whatsapp_contact: extraData.whatsappContact || null,
      };

      await supabaseDbService.upsertProfile(profileData);

      // Local DB setup
      const localProfile = {
         userId: user.id,
         fullName: fullName,
         surname: nameData.surname,
         lastName: nameData.lastName,
         role: role,
         school: profileData.school,
         bio: '',
         avatarUrl: '',
         isOnline: true,
      };
      await dbService.upsertProfile(localProfile);
      const enrichedUser = {
        ...user,
        id: user.id || (user as any).$id,
        $id: user.id || (user as any).$id,
        emailVerification: true,
        prefs: profileData
      };
      cachedCurrentUser = enrichedUser;
      localStorage.setItem('exup_offline_user', JSON.stringify(cachedCurrentUser));
      return cachedCurrentUser;
    } catch (error: any) {
      console.error('Signup failed:', error);
      throw error;
    }
  },

  async login(identifier: string, pass: string) {
    let loginId = identifier.trim();
    const isEmail = loginId.includes('@');
    
    if (!isEmail) {
      let cleaned = loginId.replace(/[^\d+]/g, '');
      if (cleaned.startsWith('0') && cleaned.length === 10) {
        cleaned = '256' + cleaned.substring(1);
      }
      const absoluteDigits = cleaned.replace(/\D/g, '');
      if (absoluteDigits.length >= 7) {
        loginId = `${absoluteDigits}@exup.internal`;
      }
    }

    try {
      const user = await supabaseAuthService.login(loginId, pass);
      if (!user) throw new Error("Login failed");
      const profile = await supabaseDbService.getProfile(user.id).catch(() => ({}));

      const enrichedUser = {
        ...user,
        id: user.id || (user as any).$id,
        $id: user.id || (user as any).$id,
        emailVerification: true,
        prefs: profile
      };
      cachedCurrentUser = enrichedUser;
      localStorage.setItem('exup_offline_user', JSON.stringify(cachedCurrentUser));
      
      const localProfile = {
        userId: user.id,
        surname: profile?.surname || '',
        lastName: profile?.last_name || profile?.lastName || 'User',
        fullName: `${profile?.surname || ''} ${profile?.last_name || profile?.lastName || ''}`.trim(),
        role: profile?.role || 'student',
        isOnline: true
     };
     await dbService.upsertProfile(localProfile);
      
      return enrichedUser;
    } catch (error: any) {
      console.error('Login failed:', error);
      throw error;
    }
  },

  async logout() {
    cachedCurrentUser = null;
    profileCache.clear();
    if (typeof localStorage !== 'undefined') {
       localStorage.removeItem('exup_offline_user');
    }
    try {
      await supabaseAuthService.logout();
      messagingService.resetSyncState();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  },

  async getCurrentUser() {
    if (cachedCurrentUser) {
      if (cachedCurrentUser.id && !cachedCurrentUser.$id) cachedCurrentUser.$id = cachedCurrentUser.id;
      if (cachedCurrentUser.$id && !cachedCurrentUser.id) cachedCurrentUser.id = cachedCurrentUser.$id;
      return cachedCurrentUser;
    }
    try {
      const user = await supabaseAuthService.getCurrentUser();
      if (!user) return null;
      
      // Ensure matching id and $id
      const uid = user.id || (user as any).$id;
      (user as any).id = uid;
      (user as any).$id = uid;

      let profile = await supabaseDbService.getProfile(uid).catch(() => null);
      if (!profile || Object.keys(profile).length === 0) {
        // Fallback to local profile
        const local = await dbService.getProfile(uid, false).catch(() => null);
        if (local) {
          profile = {
            user_id: uid,
            surname: local.surname,
            last_name: local.lastName,
            role: local.role,
            school: local.school,
            grade_class: local.studentClass,
            bio: local.bio,
            avatar_url: local.avatarUrl,
            house: local.house,
            subject_combination: local.subjectCombination,
            preferred_subjects: local.preferredSubjects ? (Array.isArray(local.preferredSubjects) ? local.preferredSubjects : local.preferredSubjects.split(',').map((s: any) => String(s).trim())) : [],
            clubs: local.clubs ? (Array.isArray(local.clubs) ? local.clubs : local.clubs.split(',').map((s: any) => String(s).trim())) : []
          };
        } else {
          profile = {};
        }
      }

      if (profile && Object.keys(profile).length > 0) {
        if (profile.preferred_subjects && Array.isArray(profile.preferred_subjects)) {
          profile.preferredSubjects = profile.preferred_subjects.join(', ');
        }
        if (profile.clubs && Array.isArray(profile.clubs)) {
          profile.clubs = profile.clubs.join(', ');
        }
        profile.avatarUrl = profile.avatar_url || profile.avatarUrl || '';
        profile.studentClass = profile.grade_class || profile.studentClass || '';
        profile.subjectCombination = profile.subject_combination || profile.subjectCombination || '';
        profile.surname = profile.surname || '';
        profile.lastName = profile.last_name || profile.lastName || '';
        profile.fullName = profile.fullName || `${profile.surname} ${profile.lastName}`.trim() || 'User';
      } else {
        profile = {
          user_id: uid,
          surname: '',
          lastName: 'Learner',
          fullName: 'Learner',
          role: 'student',
          school: '',
          studentClass: '',
          avatarUrl: ''
        };
      }

      // Save/synchronize user profile to local RxDB
      try {
        const localProfile = {
          userId: uid,
          surname: profile.surname || '',
          lastName: profile.lastName || 'Learner',
          fullName: profile.fullName || `${profile.surname || ''} ${profile.lastName || ''}`.trim(),
          role: profile.role || 'student',
          school: profile.school || '',
          studentClass: profile.studentClass || '',
          age: profile.age ? String(profile.age) : '',
          bio: profile.bio || '',
          avatarUrl: profile.avatarUrl || '',
          house: profile.house || '',
          subjectCombination: profile.subjectCombination || '',
          preferredSubjects: typeof profile.preferredSubjects === 'string' ? profile.preferredSubjects : (Array.isArray(profile.preferredSubjects) ? profile.preferredSubjects.join(', ') : ''),
          clubs: typeof profile.clubs === 'string' ? profile.clubs : (Array.isArray(profile.clubs) ? profile.clubs.join(', ') : ''),
          isOnline: true
        };
        await dbService.upsertProfile(localProfile);
        // Also update local profile cache entry
        this.updateProfileCacheEntry(uid, localProfile);
      } catch (upsertErr) {
        console.warn('App: Failed to sync user profile to local DB during session initialization:', upsertErr);
      }

      cachedCurrentUser = {
        ...user,
        id: uid,
        $id: uid,
        emailVerification: true,
        prefs: profile
      };
      
      localStorage.setItem('exup_offline_user', JSON.stringify(cachedCurrentUser));
      return cachedCurrentUser;
    } catch (err) {
      const offlineUser = localStorage.getItem('exup_offline_user');
      if (offlineUser) {
          try {
             const parsed = JSON.parse(offlineUser);
             if (parsed) {
               const uid = parsed.id || parsed.$id;
               parsed.id = uid;
               parsed.$id = uid;
               cachedCurrentUser = parsed;
               return cachedCurrentUser;
             }
          } catch (e) {}
      }
      return null;
    }
  },

  async getProfile(userId: string, ignoreCache = false) {
    if (!ignoreCache) {
      const cached = profileCache.get(userId);
      if (cached && (Date.now() - cached.time < CACHE_TTL)) {
        return cached.data;
      }
    }

    // 1. Try to load local profile first for ultra-fast, snappy UI load
    const local = await dbService.getProfile(userId, false);
    if (local && !ignoreCache) {
      // Put in memory cache and return instantly
      profileCache.set(userId, { time: Date.now(), data: local });
      
      // Asynchronously trigger remote fetch & sync in the background
      supabaseDbService.getProfile(userId).then(async (remoteProfile) => {
         if (remoteProfile) {
             const localNow = await dbService.getProfile(userId, false) || {};
             const remotePreferredSubjects = remoteProfile.preferred_subjects 
               ? (Array.isArray(remoteProfile.preferred_subjects) ? remoteProfile.preferred_subjects.join(', ') : String(remoteProfile.preferred_subjects))
               : '';
             const remoteClubs = remoteProfile.clubs 
               ? (Array.isArray(remoteProfile.clubs) ? remoteProfile.clubs.join(', ') : String(remoteProfile.clubs))
               : '';

             const mergedProfile = {
                ...localNow,
                userId: remoteProfile.user_id || userId,
                fullName: remoteProfile.surname ? `${remoteProfile.surname} ${remoteProfile.last_name || ''}`.trim() : (localNow.fullName || ''),
                surname: remoteProfile.surname || (localNow?.surname || ''),
                lastName: remoteProfile.last_name || (localNow?.lastName || 'User'),
                role: remoteProfile.role || localNow?.role || 'student',
                school: remoteProfile.school || localNow?.school || '',
                studentClass: remoteProfile.grade_class || localNow?.studentClass || '',
                age: remoteProfile.age !== undefined ? String(remoteProfile.age) : (localNow?.age || ''),
                bio: remoteProfile.bio || localNow?.bio || '',
                avatarUrl: remoteProfile.avatar_url || localNow?.avatarUrl || '',
                house: remoteProfile.house || localNow?.house || '',
                subjectCombination: remoteProfile.subject_combination || localNow?.subjectCombination || '',
                preferredSubjects: remotePreferredSubjects || localNow?.preferredSubjects || '',
                clubs: remoteClubs || localNow?.clubs || '',
                isOnline: this.computeIsOnline(remoteProfile),
                lastSeenAt: remoteProfile.last_seen_at || localNow?.lastSeenAt || null,
             };
             await dbService.upsertProfile(mergedProfile);
             profileCache.set(userId, { time: Date.now(), data: mergedProfile });
         }
      }).catch(e => console.warn('Background Supabase getProfile error', e));

      return local;
    }

    try {
      const remoteProfile = await supabaseDbService.getProfile(userId);
      if (remoteProfile) {
        const localNow = await dbService.getProfile(userId, false) || {};
        const remotePreferredSubjects = remoteProfile.preferred_subjects 
          ? (Array.isArray(remoteProfile.preferred_subjects) ? remoteProfile.preferred_subjects.join(', ') : String(remoteProfile.preferred_subjects))
          : '';
        const remoteClubs = remoteProfile.clubs 
          ? (Array.isArray(remoteProfile.clubs) ? remoteProfile.clubs.join(', ') : String(remoteProfile.clubs))
          : '';

        const mergedProfile = {
           ...localNow,
           userId: remoteProfile.user_id || userId,
           fullName: remoteProfile.surname ? `${remoteProfile.surname} ${remoteProfile.last_name || ''}`.trim() : (localNow.fullName || ''),
           surname: remoteProfile.surname || (localNow?.surname || ''),
           lastName: remoteProfile.last_name || (localNow?.lastName || 'User'),
           role: remoteProfile.role || localNow?.role || 'student',
           school: remoteProfile.school || localNow?.school || '',
           studentClass: remoteProfile.grade_class || localNow?.studentClass || '',
           age: remoteProfile.age !== undefined ? String(remoteProfile.age) : (localNow?.age || ''),
           bio: remoteProfile.bio || localNow?.bio || '',
           avatarUrl: remoteProfile.avatar_url || localNow?.avatarUrl || '',
           house: remoteProfile.house || localNow?.house || '',
           subjectCombination: remoteProfile.subject_combination || localNow?.subjectCombination || '',
           preferredSubjects: remotePreferredSubjects || localNow?.preferredSubjects || '',
           clubs: remoteClubs || localNow?.clubs || '',
           isOnline: this.computeIsOnline(remoteProfile),
           lastSeenAt: remoteProfile.last_seen_at || localNow?.lastSeenAt || null,
        };
        await dbService.upsertProfile(mergedProfile);
        profileCache.set(userId, { time: Date.now(), data: mergedProfile });
        return mergedProfile;
      }
    } catch (e) {
      console.warn('Supabase getProfile error', e);
    }

    const localFallback = await dbService.getProfile(userId, false);
    if (localFallback) {
      profileCache.set(userId, { time: Date.now(), data: localFallback });
      return localFallback;
    }
    return null;
  },

  async updateProfile(userId: string, data: any) {
    const localProfile = await dbService.getProfile(userId, false) || {};
    const updatedLocal = {
      ...localProfile,
      userId: userId,
      fullName: data.fullName ?? localProfile.fullName,
      surname: data.fullName ? data.fullName.split(' ')[0] : (localProfile.surname || ''),
      lastName: data.fullName ? (data.fullName.split(' ').length > 1 ? data.fullName.split(' ').pop() : 'User') : (localProfile.lastName || 'User'),
      school: data.school ?? localProfile.school,
      role: data.role ?? localProfile.role,
      bio: data.bio ?? localProfile.bio,
      studentClass: data.studentClass ?? localProfile.studentClass,
      age: data.age !== undefined ? String(data.age) : localProfile.age,
      avatarUrl: data.avatarUrl ?? localProfile.avatarUrl,
      house: data.house ?? localProfile.house ?? '',
      preferredSubjects: data.preferredSubjects ?? localProfile.preferredSubjects ?? '',
      subjectCombination: data.subjectCombination ?? localProfile.subjectCombination ?? '',
      clubs: data.clubs ?? localProfile.clubs ?? '',
    };
    await dbService.upsertProfile(updatedLocal);
    profileCache.delete(userId);

    if (cachedCurrentUser && (cachedCurrentUser.id === userId || cachedCurrentUser.$id === userId)) {
      cachedCurrentUser.prefs = { ...cachedCurrentUser.prefs, ...updatedLocal };
      localStorage.setItem('exup_offline_user', JSON.stringify(cachedCurrentUser));
    }

    try {
      const profileData = {
        user_id: userId,
        surname: updatedLocal.surname,
        last_name: updatedLocal.lastName,
        role: updatedLocal.role,
        age: typeof data.age === 'number' && !isNaN(data.age) ? data.age : (updatedLocal.age ? parseInt(updatedLocal.age, 10) : null),
        school: updatedLocal.school,
        grade_class: updatedLocal.studentClass,
        bio: updatedLocal.bio,
        avatar_url: updatedLocal.avatarUrl,
        house: updatedLocal.house,
        subject_combination: updatedLocal.subjectCombination,
        preferred_subjects: updatedLocal.preferredSubjects 
          ? (Array.isArray(updatedLocal.preferredSubjects) ? updatedLocal.preferredSubjects : updatedLocal.preferredSubjects.split(',').map((s: string) => s.trim()))
          : [],
        clubs: updatedLocal.clubs 
          ? (Array.isArray(updatedLocal.clubs) ? updatedLocal.clubs : updatedLocal.clubs.split(',').map((s: string) => s.trim()))
          : [],
      };
      await supabaseDbService.upsertProfile(profileData);
    } catch (err: any) {
      console.error('Supabase: failed to sync profile edit remotely', err);
    }

    return updatedLocal;
  },

  async requestPasswordRecovery(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  async requestEmailVerification() {
  },

  computeIsOnline(profile: any, nowTime: number = Date.now()): boolean {
    if (!profile) return false;
    
    // Check lastSeenAt / last_seen_at first (more reliable because it expires)
    const lastSeen = profile.lastSeenAt || profile.last_seen_at || profile.lastSeen || profile.last_seen;
    if (lastSeen) {
      const lastSeenTime = new Date(lastSeen).getTime();
      // If active in the last 2 minutes (120000 ms), consider online
      if (!isNaN(lastSeenTime)) {
        return (nowTime - lastSeenTime < 120000);
      }
    }
    
    return false;
  },

  async setOnlineStatus(userId: string, isOnline: boolean) {
    if (!userId || userId.startsWith('mock')) return;
    const nowStr = new Date().toISOString();
    try {
      // 1. Update in Supabase presence table
      const { error } = await supabaseAdmin.from('presence').upsert({
        user_id: userId,
        last_seen_at: nowStr,
        updated_at: nowStr
      }, { onConflict: 'user_id' });
      
      if (error) {
         console.warn('[authService] failed to upsert remote presence:', error.message);
      }
    } catch (err) {
      console.warn('[authService] error during remote presence update:', err);
    }

    try {
      // 1.5 Update profiles table as well so both trigger and map presence robustly
      const { error } = await supabaseAdmin.from('profiles').update({
        last_seen_at: nowStr,
        updated_at: nowStr
      }).eq('user_id', userId);
      
      if (error) {
         console.warn('[authService] failed to update profiles table remote presence:', error.message);
      }
    } catch (err) {
      console.warn('[authService] error during profiles table remote presence update:', err);
    }

    try {
      // 2. Update local profile representation in RxDB so it is immediately updated locally
      const db = await dbService.getRawDB();
      if (db && db.profiles) {
        const local = await db.profiles.findOne(userId).exec();
        if (local) {
          try {
            await local.incrementalPatch({
              isOnline,
              lastSeenAt: nowStr
            });
          } catch (err) {
            const fresh = await db.profiles.findOne(userId).exec();
            if (fresh) {
              await fresh.incrementalPatch({ isOnline, lastSeenAt: nowStr });
            }
          }
        } else {
          // If local profile hasn't been cached/created yet, we insert a skeleton
          // profile so that presence/details can be computed correctly.
          await db.profiles.incrementalUpsert({
            userId,
            surname: '',
            lastName: '',
            fullName: 'Member',
            role: 'student',
            isOnline,
            lastSeenAt: nowStr
          });
        }
      }
    } catch (localErr) {
      console.warn('[authService] failed to update local online status:', localErr);
    }
  },

  async recordLoginIP(userId: string, fullName: string, role: string, prefs: any = {}) {
  }
};
