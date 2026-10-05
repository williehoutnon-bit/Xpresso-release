import {
  databases,
  APPWRITE_CONFIG,
  isAppwriteConfigured,
  withRetry,
  Query,
} from "./appwriteService";
import { MOCK_SCHOOLS } from "../types";
import { dbService } from "./dbService";
import { authService } from "./authService";

export interface Comrade {
  name: string;
  school: string;
  points: number;
  userId: string;
  avatarUrl?: string;
  bio?: string;
  role?: string;
  studentClass?: string;
  preferredSubjects?: string;
  subjectCombination?: string;
  age?: number;
  house?: string;
  clubs?: string;
  isOnline?: boolean;
  lastSeenAt?: any;
  matchedTags?: string[];
}

const MOCK_COMRADES: Comrade[] = [];


async function safeCreateFriendship(docId: string, payload: any, permissions?: any[]) {
  const fullPayload: any = {
    userId: payload.userId,
    friendId: payload.friendId,
    status: payload.status || "Pending",
  };
  return await databases.createDocument(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.friendships,
    docId,
    fullPayload,
    permissions
  );
}

async function safeUpdateFriendship(docId: string, payload: any) {
  const fullPayload: any = {};
  if (payload.userId !== undefined) fullPayload.userId = payload.userId;
  if (payload.friendId !== undefined) fullPayload.friendId = payload.friendId;
  if (payload.status !== undefined) fullPayload.status = payload.status;
  return await databases.updateDocument(
    APPWRITE_CONFIG.databaseId,
    APPWRITE_CONFIG.collections.friendships,
    docId,
    fullPayload
  );
}

export const friendshipService = {
  /**
   * Helper to consistently extract userId from a profile or account document
   */
  _extractUserId(doc: any): string {
    return String(doc.userId || doc.user_id || doc.id || doc.$id || "").trim();
  },

  /**
   * Fetch current friends from the user's friendships collection (Offline-First)
   */
  async getCurrentFriends(userId: string): Promise<Comrade[]> {
    // 1. Try RxDB first for instant display
    try {
      const friendIds = await dbService.getLocalAcceptedFriendIds(userId);
      if (friendIds.length > 0) {
        const profiles = await Promise.all(
          friendIds.map((id) => dbService.getProfile(id)),
        );
        const result = profiles.filter(Boolean).map((prof) => ({
          userId: prof.userId,
          name: prof.fullName || prof.name || "Unknown",
          school: prof.school || "Unknown School",
          points: prof.points || 0,
          avatarUrl: prof.avatarUrl,
          bio: prof.bio,
          role: prof.role,
          studentClass: prof.studentClass,
          preferredSubjects: prof.preferredSubjects,
          subjectCombination: prof.subjectCombination,
          age: prof.age,
          house: prof.house,
          clubs: prof.clubs,
          isOnline: authService.computeIsOnline(prof),
          lastSeenAt: prof.lastSeenAt || null,
        }));

        // If we have local results, return them immediately but trigger a sync in background if online
        if (result.length > 0) {
          if (isAppwriteConfigured) {
            this.syncFriendships(userId).catch(() => {});
          }
          return result;
        }
      }
    } catch (e) {
      console.warn("getCurrentFriends: RxDB fetch failed", e);
    }

    if (!isAppwriteConfigured) return [];

    try {
      // Background sync if nothing in RxDB
      await this.syncFriendships(userId);

      // 1. Find this user's profile to see if they have another ID mapping
      const possibleUserIds = [userId];
      try {
        const userProfiles = await withRetry(() =>
          databases.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.profiles,
            [Query.equal("userId", userId), Query.limit(10)],
          ),
        );

        if (userProfiles.documents.length > 0) {
          userProfiles.documents.forEach((p) => {
            if (p.$id && !possibleUserIds.includes(p.$id))
              possibleUserIds.push(p.$id);
            if (p.userId && !possibleUserIds.includes(p.userId))
              possibleUserIds.push(p.userId);
          });
        }
      } catch (e) {
         console.warn("[friendshipService] Failed to retrieve profile for mapping in getCurrentFriends:", e);
      }

      let documents1: any[] = [];
      try {
        const friendships1 = await withRetry(() =>
          databases.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.friendships,
            [
              Query.equal("userId", possibleUserIds),
              Query.equal("status", "Accepted"),
            ],
          ),
        );
        documents1 = friendships1.documents;
      } catch (err) {
        console.warn('getCurrentFriends indexed query 1 failed, falling back');
        const { fallbackListAllDocuments } = await import('./appwriteService');
        const res = await fallbackListAllDocuments(APPWRITE_CONFIG.collections.friendships, (d:any) => possibleUserIds.includes(d.userId) && d.status === 'Accepted');
        documents1 = res.documents;
      }

      let documents2: any[] = [];
      try {
        const friendships2 = await withRetry(() =>
          databases.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.friendships,
            [
              Query.equal("friendId", possibleUserIds),
              Query.equal("status", "Accepted"),
            ],
          ),
        );
        documents2 = friendships2.documents;
      } catch (err) {
        console.warn('getCurrentFriends indexed query 2 failed, falling back');
        const { fallbackListAllDocuments } = await import('./appwriteService');
        const res = await fallbackListAllDocuments(APPWRITE_CONFIG.collections.friendships, (d:any) => possibleUserIds.includes(d.friendId) && d.status === 'Accepted');
        documents2 = res.documents;
      }

      let friendIds = [
        ...documents1.map((doc) => doc.friendId),
        ...documents2.map((doc) => doc.userId),
      ];
      friendIds = [...new Set(friendIds)].filter(
        (id) => !possibleUserIds.includes(id),
      );

      if (friendIds.length === 0) return [];

      let friendProfiles;
      try {
        friendProfiles = await withRetry(() =>
          databases.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.profiles,
            [Query.equal("userId", friendIds), Query.limit(100)],
          ),
        );
      } catch (err) {
        console.warn(
          "Batch profile fetch failed (likely missing index), fetching individually using robust dbService.getProfile...",
        );
        const individualPromises = friendIds.map((id) =>
          dbService.getProfile(id, true)
            .catch(() => null)
        );
        const docs = (await Promise.all(individualPromises)).filter(Boolean);
        friendProfiles = { documents: docs };
      }

      // Handle missing profiles by attempting to "revive" them from accounts
      const profilesMap = new Map(
        friendProfiles.documents.map((p) => [this._extractUserId(p), p]),
      );
      const missingIds = friendIds.filter((id) => !profilesMap.has(id));

      if (missingIds.length > 0) {
        console.log(
          `friendshipService: ${missingIds.length} profiles missing, attempting recovery...`,
        );
        for (const mid of missingIds) {
          try {
            const accountRes = await databases.listDocuments(
              APPWRITE_CONFIG.databaseId,
              APPWRITE_CONFIG.collections.accounts,
              [Query.equal("$id", mid), Query.limit(1)],
            );
            let profileData = {
              userId: mid,
              fullName: "Unknown Comrade",
              school: "",
              role: "student",
              studentClass: "",
              points: 100,
            };
            if (accountRes.total > 0) {
              const acc = accountRes.documents[0];
              profileData = {
                ...profileData,
                fullName: acc.name || "Comrade",
                school: acc.school || "",
                role: acc.role || "student",
                studentClass: acc.class || "",
              };
            }
            const { ID, Permission, Role } = await import("appwrite");
            const perm = [
              Permission.read(Role.any()),
              Permission.write(Role.any()),
              Permission.update(Role.any()),
              Permission.delete(Role.any()),
            ];
            const newProf = await databases.createDocument(
              APPWRITE_CONFIG.databaseId,
              APPWRITE_CONFIG.collections.profiles,
              ID.unique(),
              profileData,
              perm,
            );
            profilesMap.set(mid, newProf);
          } catch (e) {
            console.warn(`Failed to recover profile for ${mid}:`, e);
          }
        }
      }

      return Array.from(profilesMap.values()).map((prof: any) => ({
        userId: this._extractUserId(prof),
        name: prof.fullName || prof.name || "Unknown",
        school: prof.school || "Unknown School",
        points: prof.points || 0,
        avatarUrl: prof.avatarUrl,
        bio: prof.bio,
        role: prof.role,
        studentClass: prof.studentClass,
        preferredSubjects: prof.preferredSubjects,
        subjectCombination: prof.subjectCombination,
        age: prof.age,
        house: prof.house,
        clubs: prof.clubs,
        isOnline: authService.computeIsOnline(prof),
        lastSeenAt: prof.lastSeenAt || null,
      }));
    } catch (err) {
      console.error("Failed to get current friends:", err);
      return [];
    }
  },

  /**
   * Complex algorithm for comrades suggestions
   * - Tries to find people in the same school or district
   * - Specifically people who are NOT currently friends
   */
  async getSuggestedComrades(userId: string): Promise<Comrade[]> {
    const cleanUserId = (userId || "").trim().toLowerCase();
    let sessionUserId = "";
    try {
      const activeUser = authService.getCurrentUser ? await authService.getCurrentUser().catch(() => null) : null;
      if (activeUser) {
        sessionUserId = String(activeUser.id || activeUser.$id || "").trim().toLowerCase();
      }
    } catch (e) {}

    if (!isAppwriteConfigured) {
      try {
        const db = await dbService.getRawDB();
        const friendIds = await dbService.getLocalAcceptedFriendIds(userId);
        const excludeIds = new Set([
          cleanUserId,
          sessionUserId,
          ...friendIds.map((id: string) => id.trim().toLowerCase())
        ]);
        excludeIds.delete("");

        const results = await db.profiles.find().exec();
        return results
          .map((doc: any) => doc.toJSON())
          .filter((p: any) => {
            const pId = String(p.userId || p.user_id || p.$id || p.id || "").trim().toLowerCase();
            return pId && pId !== cleanUserId && pId !== sessionUserId && !excludeIds.has(pId);
          })
          .slice(0, 10)
          .map((prof: any) => ({
            userId: prof.userId,
            name: prof.fullName || prof.name || "Unknown",
            school: prof.school || "Unknown School",
            points: prof.points || 0,
            avatarUrl: prof.avatarUrl,
            bio: prof.bio,
            role: prof.role,
            studentClass: prof.studentClass,
            preferredSubjects: prof.preferredSubjects,
            subjectCombination: prof.subjectCombination,
            age: prof.age,
            house: prof.house,
            clubs: prof.clubs,
            isOnline: authService.computeIsOnline(prof),
            lastSeenAt: prof.lastSeenAt || null,
          }));
      } catch (e) {
        console.warn("getSuggestedComrades local fetch failed:", e);
        return [];
      }
    }

    try {
      // 1. Get current user's profile to know school & details
      let userProfile: any = null;
      if (userId && userId !== "temp" && userId !== "no-user") {
        try {
          const upDocs = await withRetry(() =>
            databases.listDocuments(
              APPWRITE_CONFIG.databaseId,
              APPWRITE_CONFIG.collections.profiles,
              [Query.equal("userId", userId), Query.limit(1)],
            ),
          );
          userProfile = upDocs.documents[0];
        } catch (e) {
          userProfile = await dbService.getProfile(userId, false);
        }
      }

      // 2. Build local/online exclude set of already accepted/pending friends
      const friendIds = new Set<string>();
      if (cleanUserId) {
        friendIds.add(cleanUserId);
      }
      if (sessionUserId) {
        friendIds.add(sessionUserId);
      }
      if (userId && userId !== "temp" && userId !== "no-user") {
        try {
          const db = await dbService.getRawDB();
          const localFriendships = await db.friendships
            .find({
              selector: {
                $or: [{ userId: userId }, { friendId: userId }],
              },
            })
            .exec();
          localFriendships.forEach((f: any) => {
            const data = f.toJSON();
            if (data.userId) friendIds.add(data.userId.trim().toLowerCase());
            if (data.friendId) friendIds.add(data.friendId.trim().toLowerCase());
          });
        } catch (err) {
          console.warn("Suggested Comrades exclude fetch failed:", err);
        }
      }

      // 3. Fetch pool of profiles and rank them
      let possibleProfiles: any;
      try {
        possibleProfiles = await withRetry(() =>
          databases.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.profiles,
            [Query.limit(100)],
          ),
        );
      } catch (e) {
        console.warn(
          "Friendship suggestions profiles fetch failed, listing from local RxDB",
        );
        const db = await dbService.getRawDB();
        const allLocal = await db.profiles.find().exec();
        possibleProfiles = {
          documents: allLocal.map((doc: any) => doc.toJSON()),
        };
      }

      type ScoredComrade = Comrade & { score: number };
      const scoredSuggestions: ScoredComrade[] = [];
      const seenUserIds = new Set<string>();

      for (const prof of possibleProfiles.documents) {
        const pId = this._extractUserId(prof);
        const cleanPId = pId ? pId.trim().toLowerCase() : "";
        
        if (cleanPId && cleanPId !== cleanUserId && cleanPId !== sessionUserId && !friendIds.has(cleanPId) && !seenUserIds.has(cleanPId)) {
          seenUserIds.add(cleanPId);
          let score = 0;
          const matchedTags: string[] = [];
          // Base score + random factor to shuffle ties beautifully
          score += Math.random() * 10;

          if (userProfile) {
            if (prof.school && prof.school === userProfile.school) {
              score += 50;
              matchedTags.push("Same School");
            }
            if (
              prof.studentClass &&
              prof.studentClass === userProfile.studentClass
            ) {
              score += 30;
              matchedTags.push("Same Class");
            }
            if (prof.district && prof.district === userProfile.district) {
              score += 20;
              if (!matchedTags.includes("Same School")) {
                matchedTags.push("Same District");
              }
            }
          }

          scoredSuggestions.push({
            userId: pId,
            name: prof.fullName || prof.name || "Unknown",
            school: prof.school || "Unknown School",
            points: prof.points || 0,
            avatarUrl: prof.avatarUrl,
            bio: prof.bio,
            role: prof.role,
            studentClass: prof.studentClass,
            preferredSubjects: prof.preferredSubjects,
            subjectCombination: prof.subjectCombination,
            age: prof.age,
            house: prof.house,
            clubs: prof.clubs,
            isOnline: authService.computeIsOnline(prof),
            lastSeenAt: prof.lastSeenAt || null,
            score,
            matchedTags,
          });
        }
      }

      // Sort by highest score first
      scoredSuggestions.sort((a, b) => b.score - a.score);
      return scoredSuggestions.slice(0, 10);
    } catch (err) {
      console.error("Failed to get suggested comrades:", err);
      return [];
    }
  },

  /**
   * Get incoming requests
   */
  async getIncomingRequests(userId: string): Promise<any[]> {
    // 1. Try local RxDB first for instant rendering & offline usage
    try {
      const localRequests =
        await dbService.getLocalIncomingPendingRequests(userId);
      if (localRequests.length > 0) {
        const results: any[] = [];
        for (const req of localRequests) {
          const prof = await dbService.getProfile(
            req.userId,
            false,
          );
          results.push({
            requestId: req.id,
            userId: req.userId,
            name: prof?.fullName || prof?.name || "Unknown Comrade",
            school: prof?.school || "Unknown School",
            points: prof?.points || 0,
            avatarUrl: prof?.avatarUrl,
            bio: prof?.bio,
            role: prof?.role,
            studentClass: prof?.studentClass,
            preferredSubjects: prof?.preferredSubjects,
            subjectCombination: prof?.subjectCombination,
            age: prof?.age,
            house: prof?.house,
            clubs: prof?.clubs,
          });
        }
        if (isAppwriteConfigured) {
          this.syncFriendships(userId).catch(() => {});
        }
        return results;
      }
    } catch (err) {
      console.warn("getIncomingRequests: Failed to fetch local requests:", err);
    }

    if (!isAppwriteConfigured) {
      return [];
    }

    try {
      const possibleTargetIds = [userId];
      try {
        // 1. Find this user's profile to see if they have another ID mapping, safely without risky Query.or
        const userProfiles = await withRetry(() =>
          databases.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.profiles,
            [Query.equal("userId", userId), Query.limit(5)],
          ),
        );

        if (userProfiles.documents.length > 0) {
          userProfiles.documents.forEach((p) => {
            if (p.$id && !possibleTargetIds.includes(p.$id))
              possibleTargetIds.push(p.$id);
            if (p.userId && !possibleTargetIds.includes(p.userId))
              possibleTargetIds.push(p.userId);
          });
        }
      } catch (profileErr) {
        console.warn(
          "Non-blocking: Failed to retrieve mapping profile in getIncomingRequests:",
          profileErr,
        );
      }

      // Fetch friendship documents where friend_id matches any of possibleTargetIds (with robust fallback)
      let documents: any[] = [];
      try {
        const friendships = await withRetry(() =>
          databases.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.friendships,
            [
              Query.equal("friendId", possibleTargetIds),
              Query.equal("status", "Pending"),
            ],
          ),
        );
        documents = friendships.documents;
      } catch (friendshipErr) {
        console.warn(
          "Failed to fetch friendships using batch equal. Falling back.",
        );
        const { fallbackListAllDocuments } = await import('./appwriteService');
        const res = await fallbackListAllDocuments(APPWRITE_CONFIG.collections.friendships, (d:any) => possibleTargetIds.includes(d.friendId) && d.status === 'Pending');
        documents = res.documents;
      }

      if (documents.length === 0) return [];

      // De-duplicate documents by userId to prevent multiple alerts from the same person
      const seenRequesters = new Set<string>();
      const friendshipsList = documents.filter((doc) => {
        if (seenRequesters.has(doc.userId)) return false;
        seenRequesters.add(doc.userId);
        return true;
      });

      const requesterIds = [...new Set(friendshipsList.map((d) => d.userId))];
      if (requesterIds.length === 0) return [];

      let profilesList: any[] = [];
      for (const rid of requesterIds) {
        const prof = await authService.getProfile(rid);
        if (prof) profilesList.push(prof);
      }

      const profilesMap = new Map();
      profilesList.forEach((doc) =>
        profilesMap.set(this._extractUserId(doc), doc),
      );
      const missingReqIds = requesterIds.filter((id) => !profilesMap.has(id));

      if (missingReqIds.length > 0) {
        for (const mid of missingReqIds) {
          try {
            const accountRes = await databases.listDocuments(
              APPWRITE_CONFIG.databaseId,
              APPWRITE_CONFIG.collections.accounts,
              [Query.equal("$id", mid), Query.limit(1)],
            );
            let profileData = {
              userId: mid,
              fullName: "Unknown Comrade",
              school: "",
              role: "student",
              studentClass: "",
              points: 100,
            };
            if (accountRes.total > 0) {
              const acc = accountRes.documents[0];
              profileData = {
                ...profileData,
                fullName: acc.name || "Comrade",
                school: acc.school || "",
                role: acc.role || "student",
                studentClass: acc.class || "",
              };
            }
            const { ID, Permission, Role } = await import("appwrite");
            const perm = [
              Permission.read(Role.any()),
              Permission.write(Role.any()),
              Permission.update(Role.any()),
              Permission.delete(Role.any()),
            ];
            const newProf = await databases.createDocument(
              APPWRITE_CONFIG.databaseId,
              APPWRITE_CONFIG.collections.profiles,
              ID.unique(),
              profileData,
              perm,
            );
            profilesMap.set(mid, newProf);
          } catch (e) {}
        }
      }

      return friendshipsList.map((req) => {
        let prof = profilesMap.get(req.userId);

        if (!prof) {
          if (req.userId === "6a037aac0000618c52aa") {
            prof = {
              fullName: "Willie Dev",
              school: "Exup Academy",
              studentClass: "Senior 4",
              points: 1500,
              avatarUrl:
                "https://api.dicebear.com/7.x/notionists/svg?seed=WillieDev",
              bio: "Willie Dev, active comrade and builder.",
              role: "student",
            };
          } else if (req.userId === "dev_moi_user_id") {
            prof = {
              fullName: "Dev Moi",
              school: "Exup Academy",
              studentClass: "Senior 4",
              points: 1250,
              avatarUrl:
                "https://api.dicebear.com/7.x/notionists/svg?seed=DevMoi",
              bio: "Dev Moi, learning and testing.",
              role: "student",
            };
          }
        }

        return {
          requestId: req.$id,
          userId: req.userId,
          name: prof?.fullName || prof?.name || "Unknown User",
          school: prof?.school || "Unknown School",
          points: prof?.points || 0,
          avatarUrl: prof?.avatarUrl,
          bio: prof?.bio,
          role: prof?.role,
          studentClass: prof?.studentClass,
          preferredSubjects: prof?.preferredSubjects,
          subjectCombination: prof?.subjectCombination,
          age: prof?.age,
          house: prof?.house,
          clubs: prof?.clubs,
        };
      });
    } catch (err) {
      console.error("Failed to get incoming requests:", err);
      return [];
    }
  },

  /**
   * Accept friend request
   */
  async acceptFriendRequest(requestId: string): Promise<boolean> {
    if (!isAppwriteConfigured) return true;
    try {
      // Change status to Accepted for the requester -> me
      await databases
        .updateDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.friendships,
          requestId,
          {
            status: "Accepted",
          },
        )
        .then((doc) => {
          dbService
            .upsertFriendship({
              id: doc.$id,
              userId: doc.userId,
              friendId: doc.friendId,
              status: "Accepted",
              createdAt:
                doc.createdAt || doc.$createdAt || new Date().toISOString(),
            })
            .catch(() => {});
        });

      // First fetch the original request to know who is who
      const orig = await databases.getDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.friendships,
        requestId,
      );

      const { ID, Permission, Role } = await import("appwrite");

      // Clean up/accept any other duplicate Pending requests between these same two users
      try {
        const others = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.friendships,
          [
            Query.equal("userId", orig.userId),
            Query.equal("friendId", orig.friendId),
          ],
        );
        for (const doc of others.documents) {
          if (doc.$id !== requestId && doc.status !== "Accepted") {
            await safeUpdateFriendship(doc.$id, { status: "Accepted" });
          }
        }
      } catch (e) {
        console.warn(
          "Non-blocking: failed to clean up duplicate pendings in accept:",
          e,
        );
      }

      // Check if reverse connection already exists to avoid duplicates
      const existingReverse = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.friendships,
        [
          Query.equal("userId", orig.friendId),
          Query.equal("friendId", orig.userId),
        ],
      );

      if (existingReverse.documents.length === 0) {
        const permissions = [
          Permission.read(Role.any()),
          Permission.write(Role.any()),
          Permission.update(Role.any()),
          Permission.delete(Role.any()),
        ];
        await databases.createDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.friendships,
          ID.unique(),
          {
            userId: orig.friendId,
            friendId: orig.userId,
            status: "Accepted",
          },
          permissions,
        );
      } else if (existingReverse.documents[0].status === "Pending") {
        await safeUpdateFriendship(existingReverse.documents[0].$id, { status: "Accepted" });
      }

      // Automatically create a conversation between them
      const { messagingService } = await import("./messagingService");
      await messagingService.getOrCreateConversation(orig.userId);

      return true;
    } catch (err) {
      console.error("Failed to accept friend request:", err);
      return false;
    }
  },

  /**
   * Decline/Delete friend request
   */
  async declineFriendRequest(requestId: string): Promise<boolean> {
    if (!isAppwriteConfigured) return true;
    try {
      const orig = await databases.getDocument(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.friendships,
        requestId,
      );

      if (orig) {
        const duplicates = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.friendships,
          [
            Query.equal("userId", orig.userId),
            Query.equal("friendId", orig.friendId),
          ],
        );
        for (const doc of duplicates.documents) {
          try {
            await databases.deleteDocument(
              APPWRITE_CONFIG.databaseId,
              APPWRITE_CONFIG.collections.friendships,
              doc.$id,
            );
            // Sync to local RxDB
            dbService.deleteLocalFriendship(doc.$id).catch(() => {});
          } catch (e) {}
        }

        // Also clean up reverse duplicates if any are pending
        const reverseDuplicates = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.friendships,
          [
            Query.equal("userId", orig.friendId),
            Query.equal("friendId", orig.userId),
          ],
        );
        for (const doc of reverseDuplicates.documents) {
          if (doc.status === "Pending") {
            try {
              await databases.deleteDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.friendships,
                doc.$id,
              );
              // Sync to local RxDB
              dbService.deleteLocalFriendship(doc.$id).catch(() => {});
            } catch (e) {}
          }
        }
      } else {
        // Fallback delete if orig couldn't be retrieved
        await databases.deleteDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.friendships,
          requestId,
        );
        // Sync to local RxDB
        dbService.deleteLocalFriendship(requestId).catch(() => {});
      }
      return true;
    } catch (err) {
      console.error("Failed to decline friend request:", err);
      return false;
    }
  },
  /**
   * Get friendship status between two users
   */
  async getFriendshipStatus(
    userId: string,
    friendId: string,
  ): Promise<"None" | "Pending" | "Accepted"> {
    if (!userId || !friendId) return "None";
    try {
      // 1. Try RxDB first
      try {
        const db = await dbService.getRawDB();
        const [localDir1, localDir2] = await Promise.all([
          db.friendships
            .find({ selector: { userId: userId, friendId: friendId } })
            .exec(),
          db.friendships
            .find({ selector: { userId: friendId, friendId: userId } })
            .exec(),
        ]);
        if (localDir1 && localDir1.length > 0) {
          return localDir1[0].status === "Accepted" ? "Accepted" : "Pending";
        }
        if (localDir2 && localDir2.length > 0) {
          return localDir2[0].status === "Accepted" ? "Accepted" : "Pending";
        }
      } catch (lx) {
        console.warn("getFriendshipStatus: local rxdb failed:", lx);
      }

      if (!isAppwriteConfigured) return "None";

      // Lean status check: First try direct ID matching before falling back to complex mapping
      let directMatch;
      try {
        directMatch = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.friendships,
          [
            Query.or([
              Query.and([
                Query.equal("userId", userId),
                Query.equal("friendId", friendId),
              ]),
              Query.and([
                Query.equal("userId", friendId),
                Query.equal("friendId", userId),
              ]),
            ]),
            Query.limit(1),
          ],
        );
      } catch (directMatchErr) {
        console.warn("Direct directMatch checking failed (likely missing complex query indexes), falling back to robust dual lookup:", directMatchErr);
      }

      if (directMatch && directMatch.documents.length > 0) {
        return ((directMatch.documents[0] as any).status ?? (directMatch.documents[0] as any).Status) as "Pending" | "Accepted";
      }

      // Fallback: Robust ID lookup for both parties only if direct match fails
      const [userProfs, friendProfs] = await Promise.all([
        databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.profiles,
          [Query.equal("userId", userId), Query.limit(5)],
        ),
        databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.profiles,
          [Query.equal("userId", friendId), Query.limit(5)],
        ),
      ]);

      const possibleUserIds = [userId];
      userProfs.documents.forEach((p) => {
        if (p.$id && !possibleUserIds.includes(p.$id))
          possibleUserIds.push(p.$id);
        if (p.userId && !possibleUserIds.includes(p.userId))
          possibleUserIds.push(p.userId);
      });

      const possibleFriendIds = [friendId];
      friendProfs.documents.forEach((p) => {
        if (p.$id && !possibleFriendIds.includes(p.$id))
          possibleFriendIds.push(p.$id);
        if (p.userId && !possibleFriendIds.includes(p.userId))
          possibleFriendIds.push(p.userId);
      });

      let documents: any[] = [];
      try {
        // Only query one field with the possible IDs to avoid index/query limitations on dual-array equal.
        const friendships = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.friendships,
          [Query.equal("userId", possibleUserIds), Query.limit(100)],
        );
        // Filter in-memory for matching friendId in possibleFriendIds
        documents = friendships.documents.filter((doc) =>
          possibleFriendIds.includes(doc.friendId),
        );
      } catch (err) {
        console.warn(
          "Failed dual-match query, trying fallback...",
          err,
        );
        const { fallbackListAllDocuments } = await import('./appwriteService');
        const res = await fallbackListAllDocuments(APPWRITE_CONFIG.collections.friendships, (d:any) => possibleUserIds.includes(d.userId) && possibleFriendIds.includes(d.friendId));
        documents = res.documents;
      }

      // Bidirectional / reverse check
      let reverseDocs: any[] = [];
      try {
        const res = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.friendships,
          [Query.equal("userId", possibleFriendIds), Query.limit(100)],
        );
        reverseDocs = res.documents.filter((doc) =>
          possibleUserIds.includes(doc.friendId),
        );
      } catch (err) {
        console.warn(
          "Failed dual-match reverse query, trying fallback...",
          err,
        );
        for (const fid of possibleFriendIds) {
          for (const uid of possibleUserIds) {
            try {
              const res = await databases.listDocuments(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.friendships,
                [Query.equal("userId", fid), Query.equal("friendId", uid)],
              );
              reverseDocs.push(...res.documents);
            } catch (e) {}
          }
        }
      }

      const allDocs = [...documents, ...reverseDocs];
      if (allDocs.length > 0) {
        // Find if any are 'Accepted', otherwise 'Pending'
        const hasAccepted = allDocs.some((doc) => doc.status === "Accepted");
        return hasAccepted ? "Accepted" : "Pending";
      }

      return "None";
    } catch (err) {
      console.error("Failed to get friendship status:", err);
      return "None";
    }
  },

  async getPendingRequestsIds(userId: string): Promise<string[]> {
    // 1. Try RxDB first
    try {
      const pendingIds = await dbService.getLocalPendingRequestIds(userId);
      if (pendingIds.length > 0) {
        // Trigger background sync if Appwrite is online
        if (isAppwriteConfigured) {
          this.syncFriendships(userId).catch(() => {});
        }
        return pendingIds;
      }
    } catch (e) {
      console.warn("getPendingRequestsIds: RxDB fetch failed", e);
    }

    if (!isAppwriteConfigured) return [];

    try {
      // Background sync
      this.syncFriendships(userId).catch(() => {});

      const possibleUserIds = [userId];
      try {
        const userProfiles = await withRetry(() =>
          databases.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.profiles,
            [Query.equal("userId", userId), Query.limit(5)],
          ),
        );
        if (userProfiles.documents.length > 0) {
          userProfiles.documents.forEach((p) => {
            if (p.$id && !possibleUserIds.includes(p.$id))
              possibleUserIds.push(p.$id);
            if (p.userId && !possibleUserIds.includes(p.userId))
              possibleUserIds.push(p.userId);
          });
        }
      } catch (e) {
        console.warn(
          "Non-blocking: Failed to retrieve profile for mapping in getPendingRequestsIds:",
          e,
        );
      }

      let documents: any[] = [];
      try {
        const friendships = await withRetry(() =>
          databases.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.friendships,
            [
              Query.equal("userId", possibleUserIds),
              Query.equal("status", "Pending"),
              Query.limit(100),
            ],
          ),
        );
        documents = friendships.documents;
      } catch (friendshipErr) {
        console.warn(
          "Failed to fetch friendships using batch equal. Falling back",
        );
        const { fallbackListAllDocuments } = await import('./appwriteService');
        const res = await fallbackListAllDocuments(APPWRITE_CONFIG.collections.friendships, (d:any) => possibleUserIds.includes(d.userId) && d.status === 'Pending');
        documents = res.documents;
      }

      return [...new Set(documents.map((d) => d.friendId))];
    } catch (err) {
      console.error("Failed to get pending requests:", err);
      return [];
    }
  },

  /**
   * Batch get friendship status for multiple users against a single user
   */
  async getBatchFriendshipStatuses(
    currentUserId: string,
    targetUserIds: string[],
  ): Promise<Record<string, "None" | "Pending" | "Accepted">> {
    const results: Record<string, "None" | "Pending" | "Accepted"> = {};
    if (!currentUserId || targetUserIds.length === 0) return results;

    // Default everything to None
    targetUserIds.forEach((id) => {
      results[id] = "None";
    });

    try {
      const db = await dbService.getRawDB();

      // Find local friendships where currentUserId is involved
      const recordSet1 = await db.friendships
        .find({
          selector: { userId: currentUserId },
        })
        .exec();

      const recordSet2 = await db.friendships
        .find({
          selector: { friendId: currentUserId },
        })
        .exec();

      const allLocal = [...recordSet1, ...recordSet2];

      allLocal.forEach((doc) => {
        const otherId =
          doc.userId === currentUserId
            ? doc.friendId
            : doc.userId;
        if (targetUserIds.includes(otherId)) {
          // If Accepted, it overrides a Pending status
          const currentStatus =
            doc.status === "Accepted" ? "Accepted" : "Pending";
          if (currentStatus === "Accepted" || results[otherId] !== "Accepted") {
            results[otherId] = currentStatus;
          }
        }
      });

      if (!isAppwriteConfigured) {
        return results;
      }
    } catch (localErr) {
      console.warn("Local getBatchFriendshipStatuses check failed:", localErr);
    }

    if (!isAppwriteConfigured) return results;

    try {
      // Query everything where user_id or friend_id is the current user
      // and friend_id or user_id is in the target list
      const [sent, received] = await Promise.all([
        databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.friendships,
          [
            Query.equal("userId", currentUserId),
            Query.equal("friendId", targetUserIds),
            Query.limit(100),
          ],
        ),
        databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.friendships,
          [
            Query.equal("friendId", currentUserId),
            Query.equal("userId", targetUserIds),
            Query.limit(100),
          ],
        ),
      ]);

      const allDocs = [...sent.documents, ...received.documents];

      targetUserIds.forEach((id) => {
        const doc = allDocs.find((d) => d.userId === id || d.friendId === id);
        results[id] = doc ? (doc.status as "Pending" | "Accepted") : "None";
      });

      return results;
    } catch (err) {
      console.error("Batch status check failed:", err);
      return results;
    }
  },

  /**
   * Search for students/users by name, school, or class
   */
  async searchUsers(searchTerm: string): Promise<Comrade[]> {
    if (!searchTerm || searchTerm.trim().length < 2) return [];

    const queryTerm = searchTerm.toLowerCase().trim();

    // Helper map function to convert profiles to Comrade items
    const mapProfileToComrade = (prof: any): Comrade => ({
      userId: this._extractUserId(prof),
      name: prof.fullName || prof.name || "Unknown",
      school: prof.school || "Unknown School",
      points: prof.points || 0,
      avatarUrl: prof.avatarUrl,
      bio: prof.bio,
      role: prof.role,
      studentClass: prof.studentClass,
      preferredSubjects: prof.preferredSubjects,
      subjectCombination: prof.subjectCombination,
      age: prof.age,
      house: prof.house,
      clubs: prof.clubs,
      isOnline: authService.computeIsOnline(prof),
      lastSeenAt: prof.lastSeenAt || null,
    });

    if (isAppwriteConfigured) {
      try {
        // Retrieve up to 100 profiles from Appwrite and filter them strictly in-memory.
        // This is 100% reliable, avoids index issues, and never passes through unfiltered lists.
        const res = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.profiles,
          [Query.orderDesc('$createdAt'), Query.limit(100)],
        );

        const filtered = res.documents.filter((prof) => {
          const name = (prof.fullName || prof.name || "").toLowerCase();
          const school = (prof.school || "").toLowerCase();
          const cls = (prof.studentClass || "").toLowerCase();
          return (
            name.includes(queryTerm) ||
            school.includes(queryTerm) ||
            cls.includes(queryTerm)
          );
        });

        const seen = new Set<string>();
        const dedupedFiltered = filtered.filter(p => {
            const uid = this._extractUserId(p);
            if (seen.has(uid)) return false;
            seen.add(uid);
            return true;
        });

        return dedupedFiltered.map(mapProfileToComrade);
      } catch (err) {
        console.warn(
          "Appwrite profiles batch list search failed, trying fallback search...",
          err,
        );
      }

      // Fallback robust Appwrite contains query
      try {
        const res = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.profiles,
          [Query.contains("fullName", searchTerm), Query.limit(50)],
        );
        return res.documents.map(mapProfileToComrade);
      } catch (containsErr) {
        console.warn("Appwrite Query.contains fallback failed", containsErr);
      }
    }

    // Local RxDB query fallback / Offline mode
    try {
      const db = await dbService.getRawDB();
      const localProfiles = await db.profiles.find().exec();

      const filtered = localProfiles
        .map((doc: any) => doc.toJSON())
        .filter((p: any) => {
          const name = (
            p.fullName || `${p.surname || ""} ${p.lastName || ""}`
          ).toLowerCase();
          const school = (p.school || "").toLowerCase();
          const cls = (p.studentClass || "").toLowerCase();
          return (
            name.includes(queryTerm) ||
            school.includes(queryTerm) ||
            cls.includes(queryTerm)
          );
        });

      return filtered.map((prof: any) => ({
        userId: prof.userId,
        name:
          prof.fullName ||
          `${prof.surname || ""} ${prof.lastName || ""}`.trim() ||
          "Unknown",
        school: prof.school || "Unknown School",
        points: prof.points || 0,
        avatarUrl: prof.avatarUrl,
        bio: prof.bio,
        role: prof.role,
        studentClass: prof.studentClass,
        preferredSubjects: prof.preferredSubjects,
        subjectCombination: prof.subjectCombination,
        age: prof.age,
        house: prof.house,
        clubs: prof.clubs,
        isOnline: authService.computeIsOnline(prof),
        lastSeenAt: prof.lastSeenAt || null,
      }));
    } catch (localErr) {
      console.warn("Local RxDB fallback search failed:", localErr);
      return [];
    }
  },

  async getLeaderboard(
    limit: number = 20,
    schoolFilter?: string,
  ): Promise<Comrade[]> {
    if (!isAppwriteConfigured || !APPWRITE_CONFIG.collections.profiles)
      return [];
    try {
      const queries = [Query.orderDesc("points"), Query.limit(limit)];
      if (schoolFilter) {
        queries.push(Query.equal("school", schoolFilter));
      }
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.profiles,
        queries,
      );

      return res.documents.map((prof: any) => ({
        userId: this._extractUserId(prof),
        name: prof.fullName || prof.name || "Unknown Comrade",
        school: prof.school || "Unknown School",
        points: prof.points || 0,
        avatarUrl: prof.avatarUrl,
        bio: prof.bio,
        role: prof.role,
        studentClass: prof.studentClass,
        preferredSubjects: prof.preferredSubjects,
        subjectCombination: prof.subjectCombination,
        age: prof.age,
        house: prof.house,
        clubs: prof.clubs,
        isOnline: authService.computeIsOnline(prof),
        lastSeenAt: prof.lastSeenAt || null,
      }));
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
      return [];
    }
  },

  /**
   * Fetch all registered schools
   */
  async getSchoolStaff(): Promise<any[]> {
    if (!isAppwriteConfigured) return [];
    try {
      const { Query } = await import("appwrite");
      const profiles = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.profiles,
        [Query.notEqual("role", "student"), Query.limit(10)],
      );
      return profiles.documents.map((p) => ({
        userId: p.userId || p.$id,
        name: p.fullName || p.name || "Staff",
        position: p.role,
        school: p.school,
        avatarUrl: p.avatarUrl,
      }));
    } catch (e) {
      console.warn("Failed to get staff:", e);
      return [];
    }
  },

  async getAllSchools(): Promise<any[]> {
    if (!isAppwriteConfigured) return [];
    try {
      const res = await withRetry(() =>
        databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.schools,
          [Query.limit(100)],
        ),
      );
      return res.documents;
    } catch (err) {
      console.error("Failed to fetch all schools:", err);
      // Fallback to minimal mock if real fetch fails
      return MOCK_SCHOOLS.map((s) => ({ ...s, $id: s.name, name: s.name }));
    }
  },
  /**
   * Fetch students belonging to a specific school
   */
  async getStudentsBySchool(schoolName: string): Promise<any[]> {
    if (!isAppwriteConfigured) return [];
    try {
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.profiles,
        [Query.equal("school", schoolName), Query.limit(50)],
      );
      return res.documents;
    } catch (err) {
      console.error("Failed to fetch school students:", err);
      return [];
    }
  },
  async searchSchools(searchTerm: string): Promise<any[]> {
    if (!isAppwriteConfigured) {
      if (!searchTerm) return [];
      const term = searchTerm.toLowerCase();
      return MOCK_SCHOOLS.filter((s) =>
        s.name.toLowerCase().includes(term),
      ).map((s) => ({ ...s, $id: s.name, name: s.name }));
    }
    try {
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.schools,
        [Query.search("name", searchTerm), Query.limit(10)],
      );
      return res.documents;
    } catch (err) {
      console.error("Failed to search schools:", err);
      // Fallback to contains
      try {
        const res = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.schools,
          [Query.contains("name", searchTerm), Query.limit(10)],
        );
        return res.documents;
      } catch (e) {
        return [];
      }
    }
  },

  /**
   * Get classes for a specific school
   */
  async getClassesBySchool(schoolId: string): Promise<any[]> {
    if (!isAppwriteConfigured) {
      return [
        {
          $id: "class_s4_math",
          id: "class_s4_math",
          name: "S.4 Mathematics",
          schoolId,
          membersCount: 18,
        },
        {
          $id: "class_s5_physics",
          id: "class_s5_physics",
          name: "S.5 Physics & Chemistry",
          schoolId,
          membersCount: 15,
        },
        {
          $id: "class_s6_biology",
          id: "class_s6_biology",
          name: "S.6 Biology Practice",
          schoolId,
          membersCount: 22,
        },
      ];
    }
    try {
      const res = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.classes,
        [Query.equal("schoolId", schoolId), Query.limit(100)],
      );
      return res.documents;
    } catch (err) {
      console.error("Failed to fetch classes:", err);
      return [];
    }
  },

  async sendFriendRequest(
    fromUserId: string,
    toUserId: string,
  ): Promise<boolean> {
    if (!isAppwriteConfigured) return true; // Pretend it worked for mock flow
    try {
      const currentStatus = await this.getFriendshipStatus(
        fromUserId,
        toUserId,
      );
      if (currentStatus !== "None") {
        console.log(
          `Aborting duplicate sendFriendRequest: relationship status is currently '${currentStatus}'`,
        );
        return true;
      }

      const { ID, Permission, Role } = await import("appwrite");
      const permissions = [
        Permission.read(Role.any()),
        Permission.write(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ];

      await safeCreateFriendship(ID.unique(), { userId: fromUserId, friendId: toUserId, status: "Pending" }, permissions)
        .then((doc) => {
          // Sync to local RxDB
          dbService
            .upsertFriendship({
              id: doc.$id,
              userId: fromUserId,
              friendId: toUserId,
              status: "Pending",
              createdAt: doc.$createdAt || new Date().toISOString(),
            })
            .catch(() => {});
        });
      return true;
    } catch (err) {
      console.error("Failed to send friend request:", err);
      return false;
    }
  },

  /**
   * Delete friend connection in both directions
   */
  async unfriendUser(userId: string, friendId: string): Promise<boolean> {
    if (!isAppwriteConfigured) return true;
    if (!userId || !friendId) return false;
    try {
      // Query both directions of the friendship connection
      const friendships1 = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.friendships,
        [Query.equal("userId", userId), Query.equal("friendId", friendId)],
      );
      const friendships2 = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.friendships,
        [Query.equal("userId", friendId), Query.equal("friendId", userId)],
      );

      const documentsToDelete = [
        ...friendships1.documents,
        ...friendships2.documents,
      ];

      for (const doc of documentsToDelete) {
        await databases.deleteDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.friendships,
          doc.$id,
        );
        // Sync to local RxDB
        dbService.deleteLocalFriendship(doc.$id).catch(() => {});
      }

      console.log(`Successfully unfriended ${friendId} for user ${userId}`);
      return true;
    } catch (err) {
      console.error("Failed to unfriend user:", err);
      return false;
    }
  },

  async syncFriendships(userId: string): Promise<void> {
    if (!isAppwriteConfigured || !userId) return;

    try {
      console.log(
        "[friendshipService] Triggering background friendship sync...",
      );

      let sent, received;
      try {
        const results = await Promise.all([
          databases.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.friendships,
            [Query.equal("userId", userId), Query.limit(100)],
          ),
          databases.listDocuments(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.friendships,
            [Query.equal("friendId", userId), Query.limit(100)],
          ),
        ]);
        sent = results[0];
        received = results[1];
      } catch (e: any) {
        console.warn("[friendshipService] Indexed sync failed, falling back to unindexed sync:", e);
        const { fallbackListAllDocuments } = await import('./appwriteService');
        sent = await fallbackListAllDocuments(APPWRITE_CONFIG.collections.friendships, (d: any) => d.userId === userId);
        received = await fallbackListAllDocuments(APPWRITE_CONFIG.collections.friendships, (d: any) => d.friendId === userId);
      }

      const allRemoteDocs = [...sent.documents, ...received.documents];

      // 2. Map to RxDB schema
      const friendshipsToUpsert = allRemoteDocs.map((doc) => ({
        id: doc.$id,
        userId: doc.userId,
        friendId: doc.friendId,
        status: doc.status || "Pending",
        createdAt: doc.$createdAt || new Date().toISOString(),
      }));

      // 3. Bulk upsert to RxDB
      await dbService.bulkUpsertFriendships(friendshipsToUpsert).catch((e) => {
        console.error("[friendshipService] Tx Error:", e);
      });

      // 4. Also ensure profiles of these friends are cached
      const otherUserIds = new Set<string>();
      allRemoteDocs.forEach((doc) => {
        if (doc.userId !== userId) otherUserIds.add(doc.userId);
        if (doc.friendId !== userId) otherUserIds.add(doc.friendId);
      });

      if (otherUserIds.size > 0) {
        // We don't wait for profile sync as it could be slow
        Promise.all(
          Array.from(otherUserIds).map((id) => dbService.getProfile(id, true)),
        ).catch(() => {});
      }

      console.log(
        `[friendshipService] Synced ${friendshipsToUpsert.length} friendships to local RxDB.`,
      );
    } catch (err: any) {
      const errStr = err?.message || err?.toString?.() || "";
      if (
        errStr.toLowerCase().includes("fetch") ||
        errStr.toLowerCase().includes("network")
      ) {
        console.warn(
          "friendshipService: Background sync pending network availability",
        );
      } else {
        console.error("friendshipService: Failed to sync friendships:", err);
      }
    }
  },
};
