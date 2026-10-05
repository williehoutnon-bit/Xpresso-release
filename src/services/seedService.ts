import { ID, Query, Permission, Role } from './appwriteService';
import { databases, APPWRITE_CONFIG, isAppwriteConfigured } from './appwriteService';
import { dbService } from './dbService';
import { authService } from './authService';

const MOCK_USERS: any[] = [];

const WILLIE_ID = '6a037aac0000618c52aa';

export const seedService = {
  async seedMockData() {
    const currentUser = await authService.getCurrentUser();
    const myId = currentUser?.$id || WILLIE_ID;
    console.log(`Starting seed process for user ${myId}...`);
    
    for (const user of MOCK_USERS) {
      try {
        // --- 1. LOCAL SEEDING (RxDB) ---
        const nameParts = user.name.split(' ');
        
        // Seed Profile (Local)
        await dbService.upsertProfile({
          userId: user.id,
          surname: nameParts[0],
          lastName: nameParts[nameParts.length - 1],
          middleName: nameParts.length > 2 ? nameParts[1] : '',
          role: user.role,
          ipAddresses: [user.ip]
        });

        // Seed Conversation (Local) - A conversation with Me
        const shortUser = user.id.replace('user_', '');
        const convoId = `c_${shortUser}_${myId.slice(-4)}`;
        await dbService.upsertConversation({
          id: convoId,
          name: user.name, // The UI shows the name of the peer
          isGroup: false,
          createdAt: new Date().toISOString(),
          ip: user.ip
        });

        // Seed Participants (Local)
        // 1. Mock User Participant
        await dbService.upsertParticipant({
          id: `p_${shortUser}_${convoId}`,
          conversationId: convoId,
          userId: user.id,
          lastReadAt: new Date(Date.now() - 60000).toISOString(),
          ip: user.ip
        });
        // 2. Current User Participant
        await dbService.upsertParticipant({
          id: `p_me_${convoId}`,
          conversationId: convoId,
          userId: myId,
          lastReadAt: new Date(Date.now() - 60000).toISOString(),
          ip: '127.0.0.1'
        });

        // Seed Message (Local) - From external user to Me
        const msgId = `m_${shortUser}_${convoId}`;
        await dbService.upsertMessage({
          id: msgId,
          conversationId: convoId,
          senderId: user.id,
          content: user.firstMsg,
          type: 'text',
          createdAt: new Date().toISOString(),
          status: 'delivered',
          ip: user.ip,
          attachments: []
        });

        console.log(`Successfully seeded conversation with ${user.name} into RxDB.`);

        // --- 2. REMOTE SYNC (Appwrite) ---
        if (isAppwriteConfigured) {
          try {
            await this.syncToAppwrite(user, convoId, myId, msgId);
          } catch (remoteErr: any) {
            console.error(`Appwrite sync failed for ${user.name}:`, remoteErr.message);
          }
        }

      } catch (err) {
        console.error(`Error in seeding process for ${user.name}:`, err);
      }
    }
    
    return { success: true };
  },

  async syncToAppwrite(user: any, convoId: string, myId: string, msgId: string) {
    // 1. Seed Accounts (Remote) - Detailed registration data
    if (APPWRITE_CONFIG.collections.accounts) {
      const nameParts = user.name.split(' ');
      
      let accounts;
      try {
        accounts = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.accounts,
          [Query.equal('userId', user.id)]
        );
      } catch (err: any) {
        throw err;
      }

      const accountData: any = {
        name: user.name,
        role: user.role,
        age: 16,
        school: 'Exup Academy',
        district: 'Kampala',
        country: 'Uganda',
        class: 'Senior 4',
        exupCode: `exup-a${user.id.slice(-5).toUpperCase()}`,
        ip: user.ip
      };

      const permissions = [
        Permission.read(Role.any()),
        Permission.write(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ];

      if (accounts.total === 0) {
        try {
          await databases.createDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.accounts, ID.unique(), { ...accountData, userId: user.id }, permissions);
        } catch (err: any) {
          throw err;
        }
      }
    }

    // 2. Seed Profiles (Remote) - Basic public info
    if (APPWRITE_CONFIG.collections.profiles) {
      let profiles;
      try {
        profiles = await databases.listDocuments(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.profiles,
          [Query.equal('userId', user.id)]
        );
      } catch (err: any) {
        throw err;
      }

      const permissions = [
        Permission.read(Role.any()),
        Permission.write(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ];

      if (profiles.total === 0) {
        const profileData = {
          name: user.name,
          role: user.role,
          exupCode: `exup-a${user.id.slice(-5).toUpperCase()}`,
          ip: user.ip
        };
        try {
          await databases.createDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.profiles, ID.unique(), { ...profileData, userId: user.id }, permissions);
        } catch (err: any) {
          throw err;
        }
      }
    }

    // 3. Seed Conversation (Remote)
    if (APPWRITE_CONFIG.collections.conversations) {
      try {
        await databases.getDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.conversations, convoId);
      } catch (e) {
        const permissions = [
          Permission.read(Role.any()),
          Permission.write(Role.any()),
          Permission.update(Role.any()),
          Permission.delete(Role.any()),
        ];

        await databases.createDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.conversations,
          convoId,
          {
            name: user.name, // Using 'name' for conversation title
            isGroup: false,
            type: 'direct',
            ip: user.ip
          },
          permissions
        );
        
        // 4. Seed Participants (Remote) - Linking mock user and Me
        if (APPWRITE_CONFIG.collections.participants) {
          const createParticipant = async (uid: string) => {
            const partData = {
              conversationId: convoId,
              role: 'member'
            };
            try {
              await databases.createDocument(APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.participants, ID.unique(), { ...partData, userId: uid }, permissions);
            } catch (err: any) {
              throw err;
            }
          };

          // Participant 1: Mock User
          await createParticipant(user.id);
          // Participant 2: Me
          await createParticipant(myId);
        }

        // 5. Seed Message (Remote)
        if (APPWRITE_CONFIG.collections.messages) {
          await databases.createDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.messages,
            msgId,
            {
              conversationId: convoId,
              senderId: user.id,
              content: user.firstMsg,
              type: 'text',
              status: 'delivered',
              ip: user.ip
            },
            permissions
          );
        }
      }
    }
  }
};
