# High Scalability & Concurrency Guide (Appwrite + RxDB)

To support thousands of users with shared, concurrent data (notes, profiles, etc.), we follow these architecture patterns.

## 1. Authentication & Roles
Appwrite's built-in `Account` handles auth. For scalability and "social" features:
- **Teams**: Use Appwrite Teams for specific groups (e.g., a "Classroom" or "Study Group").
- **Preferences**: Store non-sensitive metadata (like UI theme) in User Preferences.
- **Profiles Collection**: Create a `profiles` collection where each document ID is the User's UID. Give it `read("any")` and `update("user:[UID]")` permissions.

## 2. Shared Data (Notes/Exams)
For data that many people read but few edit:
- **Permissions**: Use `Role-based` access.
  - Teachers: `read("any")`, `create("any")`, `update("role:teacher")`.
  - Students: `read("any")`.

For data where many people edit (Collaborative Notes):
- **Conflict Management**: Since standard Appwrite is Last-Write-Wins, use **RxDB** as a buffer. 
- **RxDB Persistence**: Encrypted local IndexedDB ensures high performance even with thousands of local documents.
- **Incremental Replication**: RxDB syncs only changed documents, reducing Appwrite load.

## 3. Recommended Appwrite Console Settings
To support 1000s of users:
- **Indexes**: Add attribute indexes to all collections for query performance (e.g., `userId` index on notes).
- **Abuse Control**: Adjust Rate Limiting in the Appwrite Console -> Settings -> Abuse to ensure the app doesn't hit limits during peak hours.
- **Max File Size**: Increase Storage limits for large note attachments.

## 4. Permission Logic Implementation
Always use `Permission` objects in Appwrite calls:
```ts
import { Permission, Role } from 'appwrite';

// Create a note editable by a specific team and readable by all
databases.createDocument(
  '[DB_ID]', 
  '[COLLECTION_ID]', 
  ID.unique(), 
  { title: 'New Note' },
  [
    Permission.read(Role.any()),
    Permission.update(Role.team('study_group_id'))
  ]
);
```

## 5. Web Platform Configuration (CORS)
To allow your app to talk to Appwrite, you **must** add a Web Platform in the Appwrite Console under "Settings" -> "Platforms":
- **Platform Type**: Web App
- **Name**: Exup Web
- **Hostname**: 
  - `ais-dev-i2yqcwvv7izju4j2dexk3a-96336996519.europe-west2.run.app`
  - `ais-pre-i2yqcwvv7izju4j2dexk3a-96336996519.europe-west2.run.app`
  - `ai.studio`

Without this step, your app will encounter "Failed to fetch" errors due to security restrictions.

## 6. Appwrite Collection Schemas

Create these collections in your Appwrite Database to support thousands of users.

### Collection: `profiles`
*Store extended user information.*

| Attribute | Type | Size | Required | Description |
|-----------|------|------|----------|-------------|
| `userId` | String | 36 | **Yes** | The Account UID |
| `surname` | String | 64 | **Yes** | Family Name |
| `middleName` | String | 64 | No | Middle Name |
| `lastName` | String | 64 | **Yes** | Given Name (Greeting Name) |
| `role` | String | 20 | **Yes** | student, teacher, etc. |
| `age` | Integer | - | **Yes** | User Age |
| `school` | String | 128 | **Yes** | School Name |
| `district` | String | 100 | **Yes** | District Name |
| `country` | String | 100 | **Yes** | Country Name |
| `class` | String | 64 | **Yes** | Current Grade/Class |
| `exupCode` | String | 16 | **Yes** | Unique code (exup-aXXXXX) |
| `studentNIN` | String | 32 | No | National ID |
| `studentLIN` | String | 32 | No | Learner ID |
| `parentNIN` | String | 32 | No | Parent's National ID |
| `studentContact`| String | 20 | No | Student Phone |
| `parentContact` | String | 20 | No | Parent Phone |
| `whatsappContact` | String | 20 | No | WhatsApp Number |

**Permissions:**
- **Create**: `role:all` (Allow anyone to create their profile)
- **Read**: `role:all` (Allows users to find each other)
- **Update**: `user:[userId]` (Only the owner can edit)
- **Delete**: `role:member` or restrict to `admin` team.

---

### Collection: `annotations`
*Sync RxDB notes to the cloud.*

| Attribute | Type | Size | Required | Description |
|-----------|------|------|----------|-------------|
| `userId` | String | 36 | Yes | Owner of the note |
| `text` | String | 10000 | Yes | Content or highlighted text |
| `color` | String | 20 | Yes | UI highlight color |
| `note` | String | 5000 | No | Personal comments |
| `timestamp` | Integer | - | Yes | Unix timestamp |

**Permissions:**
- **Create**: `role:all`
- **Read**: `user:[userId]` (Private by default)
- **Update**: `user:[userId]`
- **Delete**: `user:[userId]`

---

### Collection: `exams`
*Published exam papers.*

| Attribute | Type | Size | Required | Description |
|-----------|------|------|----------|-------------|
| `creatorId` | String | 36 | Yes | Teacher UID |
| `title` | String | 128 | Yes | Exam Name |
| `duration` | Integer | - | Yes | Minutes |
| `questions` | String (JSON) | 65535| Yes | Array of question objects |
| `isPublic` | Boolean | - | Yes | Visible to all students |

**Permissions:**
- **Create**: `role:teacher` (Or use a custom "teachers" team)
- **Read**: `role:all` (If `isPublic` is true)
- **Update**: `user:[creatorId]`
- **Delete**: `user:[creatorId]`
