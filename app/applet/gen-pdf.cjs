const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument();
doc.pipe(fs.createWriteStream('/app/applet/public/Messaging_Architecture.pdf'));

doc.fontSize(20).text('Messaging Architecture', { align: 'center' });
doc.moveDown();

doc.fontSize(16).text('Overview');
doc.fontSize(12).text('The application uses a robust local-first messaging architecture powered by RxDB and Appwrite.');
doc.moveDown();

doc.fontSize(16).text('Messaging Flow');
doc.fontSize(12)
   .text('1. Local Optimistic Write: When a message is sent, it\'s immediately written to the local RxDB database (`messages` collection).')
   .text('2. Background Sync: `dbReplicationService.ts` listens for local changes and pushes them to the Appwrite remote database.')
   .text('3. Real-time Updates: `messagingService.ts` maintains an active Appwrite Realtime subscription. Incoming messages from other users trigger an upsert to the local RxDB.');
doc.moveDown();

doc.fontSize(16).text('Inbox Incoming Message Display');
doc.fontSize(12).text('The Inbox (`InboxView.svelte`) reacts directly to local RxDB state. The query `dbService.getConversations()` continuously streams conversation updates. When an incoming message arrives via Appwrite, it\'s written to RxDB. The RxDB query automatically pushes the new data to the UI, highlighting the unread message.');
doc.moveDown();

doc.fontSize(16).text('Swipe Delete Relationship');
doc.fontSize(12)
   .text('When a conversation is swipe-deleted in the UI:')
   .text('1. Local Update: The participant record is marked with `isDeleted: true` in RxDB. This removes it from the Inbox query immediately.')
   .text('2. Remote Push: The update syncs to Appwrite.')
   .text('3. Restoration: If a new message is received in that conversation later, the realtime handler in `messagingService.ts` detects it, updates `isDeleted` to `false`, and the conversation reappears in the Inbox locally.');

doc.end();
console.log('PDF generated');
