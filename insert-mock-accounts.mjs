import { Client, Databases } from 'node-appwrite';

const project = process.env.VITE_APPWRITE_PROJECT_ID;
const endpoint = process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const secretKey = process.env.Seeding;
const dbId = process.env.VITE_APPWRITE_DATABASE_ID;

const client = new Client()
    .setEndpoint(endpoint)
    .setProject(project)
    .setKey(secretKey);

const databases = new Databases(client);

const MOCK_USERS = [
  { id: 'user_grace', name: 'Grace Atim', role: 'student', ip: '197.157.10.1', firstMsg: "Hey! Did you see Mr. Kato's Biology question?", school: 'Gayaza High' },
  { id: 'user_brian', name: 'Brian Mugisha', role: 'student', ip: '41.210.128.5', firstMsg: "Can you explain how you solved Q3 in today's Maths exam?", school: 'SMACK' },
  { id: 'user_kato', name: 'Mr. Kato', role: 'teacher', ip: '102.64.12.99', firstMsg: "Aisha, your answer on photosynthesis was excellent.", school: 'Budo' },
  { id: 'user_sarah', name: 'Sarah Nalwoga', role: 'student', ip: '154.23.1.44', firstMsg: "Are you coming to the library revision tomorrow?", school: "Mt. St. Mary's Namagunga" },
  { id: 'user_daniel', name: 'Daniel Ochieng', role: 'student', ip: '105.112.33.2', firstMsg: "The physics lab report is due Friday, right?", school: 'Namilyango College' },
  { id: 'user_moses', name: 'Moses Okello', role: 'student', ip: '197.157.10.88', firstMsg: "Need help with the geography map work.", school: 'Seeta High' }
];

async function run() {
    for (const u of MOCK_USERS) {
        try {
            const parts = u.name.split(' ');
            await databases.createDocument(dbId, 'accounts', u.id, {
                Surname: parts[0],
                Lastname: parts.slice(1).join(' '),
                Role: u.role,
                School: u.school,
                email: u.id + '@mock.com',
                accountStatus: 'active',
                registrationDate: new Date().toISOString(),
                Subscriptionend: new Date().toISOString(),
                membershipLevel: 'basic',
                Country: 'Uganda',
                District: 'Kampala',
                Age: 16,
                Class: 'S.4',
                Phonenumber: 256700000000
            });
            console.log("Mock user inserted into accounts:", u.name);
        } catch(e) {
            console.error("Skipped or error for", u.name, e.message);
        }
    }
}
run();
