
import { dbService } from './dbService';
import { authService } from './authService';
import { ID } from './appwriteService';

/**
 * Quick service to seed specific media messages for testing
 */
export const quickSeedService = {
  async seedMediaFromMoses() {
    try {
      const currentUser = await authService.getCurrentUser();
      if (!currentUser) {
        console.error('QuickSeed: No user logged in');
        return { success: false, error: 'No user logged in' };
      }
      
      const myId = currentUser.$id;
      const mosesId = 'user_moses';
      const convoId = 'convo_user_moses'; // Match the ID in InboxView suggested contacts
      
      console.log(`QuickSeed: Seeding messages for convo ${convoId} from ${mosesId}`);

      // Ensure conversation exists locally
      await dbService.upsertConversation({
        id: convoId,
        name: 'Moses Okello',
        is_group: false,
        created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        ip: '197.157.10.88'
      });

      // Ensure participant (me) exists locally so it shows in my inbox
      await dbService.upsertParticipant({
        id: `${convoId}_${myId}`,
        conversation_id: convoId,
        user_id: myId,
        last_read_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        ip: '197.157.10.88'
      });

      // Ensure participant (Moses) exists locally so queries can find him
      await dbService.upsertParticipant({
        id: `${convoId}_${mosesId}`,
        conversation_id: convoId,
        user_id: mosesId,
        last_read_at: new Date(Date.now() - 7200000).toISOString(),
        ip: '197.157.10.88'
      });

      // 1. Text message
      await dbService.upsertMessage({
        id: `qm_text_${Date.now()}`,
        conversation_id: convoId,
        sender_id: mosesId,
        content: "Check out these resources I found for the geography project! 🌍",
        type: 'text',
        created_at: new Date().toISOString(),
        status: 'delivered',
        ip: '197.157.10.88',
        attachments: []
      });

      // 2. Image message
      await dbService.upsertMessage({
        id: `qm_img_${Date.now()}`,
        conversation_id: convoId,
        sender_id: myId,
        content: "Oh nice! Let me see",
        type: 'text',
        created_at: new Date(Date.now() + 500).toISOString(),
        status: 'read',
        ip: '197.157.10.88',
        attachments: []
      });

      // 3. Image message from Moses
      await dbService.upsertMessage({
        id: `qm_img_2_${Date.now()}`,
        conversation_id: convoId,
        sender_id: mosesId,
        content: "Map reference image",
        type: 'image',
        created_at: new Date(Date.now() + 1000).toISOString(),
        status: 'delivered',
        ip: '197.157.10.88',
        attachments: [
          {
            type: 'image',
            url: 'https://images.unsplash.com/photo-1526772662000-3f88f10405ff?w=800&q=80',
            // thumbnail: removed since it's not in schema
          }
        ]
      });

      // 4. Audio message
      await dbService.upsertMessage({
        id: `qm_audio_${Date.now()}`,
        conversation_id: convoId,
        sender_id: mosesId,
        content: "Voice note explanation",
        type: 'audio',
        created_at: new Date(Date.now() + 2000).toISOString(),
        status: 'delivered',
        ip: '197.157.10.88',
        attachments: [
          {
            type: 'audio',
            url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            duration: 360,
            waveform: JSON.stringify(Array.from({length: 50}, () => Math.random()))
          }
        ]
      });

      // 4. Video message
      await dbService.upsertMessage({
        id: `qm_video_${Date.now()}`,
        conversation_id: convoId,
        sender_id: mosesId,
        content: "Detailed video tour",
        type: 'video',
        created_at: new Date(Date.now() + 3000).toISOString(),
        status: 'delivered',
        ip: '197.157.10.88',
        attachments: [
          {
            type: 'video',
            url: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-city-waiting-for-someone-34487-large.mp4',
            // thumbnail: removed since it's not in schema
          }
        ]
      });

      console.log('QuickSeed: Successfully seeded 4 messages from Moses.');
      return { success: true };
    } catch (err) {
      console.error('QuickSeed failed:', err);
      return { success: false, error: err };
    }
  }
};
