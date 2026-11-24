# Memora AI --- Development Roadmap

**Repository:**
https://github.com/Sakshij2810/Personal-AI-Memory-Action-Assistant\
**Product vision:** `R&D/Research/project-idea.md`\
**Planning target:** Approximately 2--3 focused development days per
phase. AI model setup, debugging and deployment can take longer; treat
the estimates as targets, not deadlines.

## Product direction

Memora AI is a personal assistant that understands information inside a
user's photos, screenshots, documents, videos and audio recordings. It
connects files with people, events, dates, places and facts, then helps
users search their memories and perform approved tasks.

### Product rules

- AI may suggest similar faces, but users confirm identities and
  relationships.
- Answers should be grounded in retrieved records and original files.
  If uncertain, say so.
- A photo may belong to multiple collections (for example, Mother and
  Haldi).
- Users can review, correct and delete extracted information.
- Important actions such as deleting, moving or sharing require user
  confirmation.
- Every user's files and memories must remain private.

### How to use this roadmap

- Complete one phase at a time. Each phase should leave a working
  feature.
- Test with 20--50 sample images first, then 100+, before trying
  thousands.
- Keep commits at the end of each completed milestone.
- Do not add technologies from future phases early just because they
  are part of the long-term stack.
- If a phase takes longer than three days, reduce its scope rather
  than skipping testing.

---

# Phase 1 --- Project Foundation & Media Upload

`<badge>`{=html}Completed`</badge>`{=html} Beginner level \| First
milestone

## 1. What are we building?

A working application where a user can register, log in, upload
photographs, view them in a gallery and delete them. At this stage, the
application stores and manages photographs; it does not need to
understand their contents.

## 2. Features

---

No. Feature What it does

---

1 User authentication User can sign up and
log in.

2 Media upload Upload multiple images.

3 File validation Accept supported image
formats and reject
invalid files.

4 Media storage Store original images
safely.

5 Media metadata Save filename, file
size, type and upload
date.

6 Media gallery Display uploaded images
in a grid.

7 Delete media Delete the image and
its database record.

8 Upload status Show upload progress
and errors.

---

## 3. Technologies

React + TypeScript, Tailwind CSS, Node.js + Express, PostgreSQL,
Firebase Authentication, Multer and local file storage.

## 4. Completed checklist

- [x] Create frontend and backend project structure.
- [x] Configure PostgreSQL and create the required tables.
- [x] Configure Firebase Authentication and protected backend routes.
- [x] Build image upload APIs with validation.
- [x] Configure local media storage.
- [x] Save image metadata in PostgreSQL.
- [x] Build the media gallery.
- [x] Implement image deletion.

## 5. Definition of done

- [x] User can register and log in.
- [x] User can upload multiple photographs.
- [x] Images are stored and metadata is saved.
- [x] Gallery loads images after refreshing.
- [x] User can delete their own images.
- [x] Backend checks ownership before serving or deleting images.

**Deliverable:** A working application to securely upload and manage
personal photographs.

---

# Phase 2 --- Background Media Processing Foundation

Beginner level \| Target: 2--3 days

## 1. What are we building?

An uploaded image will soon need several tasks: reading image
information, generating thumbnails, detecting faces and understanding
its contents. These tasks should not run inside the upload request.

Build a small background-processing pipeline that can accept jobs and
process them separately.

## 2. Features to implement

---

No. Feature What it does

---

1 Processing status Track queued,
processing, completed
and failed states.

2 Job queue Add uploaded images to
a background queue.

3 Worker Process jobs separately
from the upload API.

4 Image metadata Read image dimensions
and format.

5 Thumbnail generation Create a smaller
preview without
changing the original.

6 Error handling Record failures and
allow retries.

---

## 3. How it works

1.  User uploads an image.
2.  Express stores the original and its metadata.
3.  Backend adds a processing job to the queue.
4.  A separate worker picks up the job.
5.  Worker reads image information and generates a thumbnail.
6.  Worker updates the processing status in PostgreSQL.
7.  Frontend displays the latest status.

## 4. Database changes

Add appropriate fields to `media_files` or create a processing table.

Field Purpose

---

processing_status queued, processing, completed or failed
width / height Image dimensions
thumbnail_key Thumbnail storage location
processing_error Safe error details for debugging
processed_at Processing completion time

Keep upload status and processing status conceptually separate if both
are needed.

## 5. Technologies

Technology Why

---

BullMQ Manage background jobs.
Redis Queue storage and coordination.
Sharp Read image metadata and generate thumbnails.
PostgreSQL Store processing status and image information.
Node.js worker Process jobs outside the upload request.

## 6. Not needed yet

InsightFace, face embeddings, OCR, LLM APIs, video processing and voice
features.

## 7. Development checklist

- [ ] Add processing status to the data model.
- [ ] Configure BullMQ using the existing Redis instance.
- [ ] Create a media-processing queue.
- [ ] Create a separate worker process.
- [ ] Enqueue a job after a successful upload.
- [ ] Read image dimensions and format.
- [ ] Generate a thumbnail without modifying the original.
- [ ] Update status to completed or failed.
- [ ] Add a retry path for failed jobs.
- [ ] Test multiple images and a worker restart.

## 8. When is Phase 2 complete?

- [ ] Upload requests do not wait for processing to finish.
- [ ] Uploaded images are added to the queue.
- [ ] Worker processes jobs independently.
- [ ] Original files remain unchanged.
- [ ] Thumbnails are generated successfully.
- [ ] Processing status is visible in the database.
- [ ] Failed jobs can be retried.

**Deliverable:** A reliable background pipeline ready for
image-understanding tasks.

---

# Phase 3 --- Image Understanding & Basic Visual Analysis

Beginner-to-intermediate level \| Target: 2--3 days

## 1. What are we building?

Make the application understand basic visual information about a
photograph. For example, it may suggest that an image contains people,
flowers, decorations, food or an outdoor setting.

These are AI-generated suggestions, not verified facts.

## 2. Features to implement

---

No. Feature What it does

---

1 Image analysis Send an image to one
vision-capable
model/service.

2 Image description Generate a short
description.

3 Scene labels Extract a few useful
labels.

4 Confidence Store confidence when
the model provides it.

5 Reviewable results Save analysis
separately from the
original.

6 Reprocessing Retry failed analysis
jobs.

---

## 3. Example

For `wedding_photo_01.jpg`, the analysis might return:

- Description: People standing together at a wedding celebration.
- Labels: people, wedding, celebration, indoor.
- Status: completed.

## 4. Technologies

A Python service or one vision API, OpenCV when basic image operations
are needed, a vision-capable model, BullMQ and PostgreSQL. Choose one
analysis approach first; do not integrate multiple providers at once.

## 5. Not needed yet

Face identity matching, relationship inference, event timelines and
natural-language chat.

## 6. Development checklist

- [ ] Choose one image-analysis approach.
- [ ] Create a small analysis service.
- [ ] Connect the worker to the service.
- [ ] Generate a short image description.
- [ ] Extract a small set of labels.
- [ ] Store results linked to the media record.
- [ ] Handle unsupported images and failures.
- [ ] Show descriptions and labels in the image details UI.
- [ ] Test different types of photographs.

## 7. When is Phase 3 complete?

- [ ] Images can be analysed in the background.
- [ ] Descriptions and labels are saved.
- [ ] Original images remain unchanged.
- [ ] Failed analysis does not break the gallery.
- [ ] Users can see generated descriptions.

**Deliverable:** Images have basic machine-generated descriptions and
labels.

---

# Phase 4 --- Face Detection & Face Embeddings

Intermediate level \| Target: 2--3 days for a first prototype

## 1. What are we building?

Detect faces in photographs and create numerical representations called
face embeddings. Embeddings help compare whether faces in different
photographs may belong to the same person.

Do not assign names or relationships automatically.

## 2. Features to implement

---

No. Feature What it does

---

1 Face detection Find faces inside a
photograph.

2 Face cropping Extract detected face
regions.

3 Face embeddings Generate a numerical
representation for each
face.

4 Similarity comparison Compare embeddings to
find likely matches.

5 Unknown people Keep faces unassigned
until reviewed.

6 Processing status Track face-processing
success or failure.

---

## 3. How it works

1.  Worker loads the original image.
2.  Face detector finds face locations.
3.  Face model generates embeddings.
4.  Backend saves face records linked to the source image.
5.  Similar embeddings can later be grouped for user review.

## 4. Database changes

Create a `detected_faces` table with fields such as:

Field Purpose

---

id Unique face record
media_id Source image
bounding_box Face location in the image
embedding Numerical face representation
created_at Detection date

Use a vector-compatible storage approach when ready; do not store
embeddings as arbitrary text.

## 5. Technologies

Python, OpenCV, InsightFace, PostgreSQL and pgvector when vector
similarity search is introduced.

## 6. Not needed yet

Automatic person naming, family relationship inference or identifying
public figures.

## 7. Development checklist

- [ ] Set up a Python image-processing service.
- [ ] Install and test one face-detection model.
- [ ] Detect faces in a sample image.
- [ ] Save face bounding boxes.
- [ ] Generate embeddings.
- [ ] Store face records linked to media.
- [ ] Compare two embeddings for similarity.
- [ ] Handle images with no detected faces.
- [ ] Test different lighting, angles and image quality.

## 8. When is Phase 4 complete?

- [ ] Faces can be detected.
- [ ] Embeddings are generated and stored.
- [ ] Face records link to original images.
- [ ] Similarity comparison works on a small test set.
- [ ] No person's identity is automatically assumed.

**Deliverable:** The application can detect and compare faces without
claiming to know who they are.

---

# Phase 5 --- People Grouping & User Identity Confirmation

Intermediate level \| Target: 2--3 days for a first usable version

## 1. What are we building?

Use face similarity to suggest groups of photographs that may contain
the same person. The user reviews each group and confirms who the person
is.

## 2. Features to implement

---

No. Feature What it does

---

1 Similar-face grouping Group likely matching
face embeddings.

2 Unknown people list Display groups without
confirmed identities.

3 Group preview Show sample photographs
for each group.

4 Confirm identity Let the user assign a
name or label.

5 Correct grouping Move a face or remove
it from a group.

6 Merge/split groups Correct incorrect
groupings.

7 Person gallery Show photographs linked
to a confirmed person.

---

## 3. How it works

1.  Compare face embeddings and create suggested groups.
2.  Display groups in an unknown-people screen.
3.  User reviews photographs in a group.
4.  User confirms a name or corrects the grouping.
5.  Save the confirmed identity.

## 4. Database concepts

- `people`: user-created person records.
- `face_groups`: suggested or reviewed groups.
- `detected_faces`: links to the source image and optional
  group/person.

Person records must be scoped to their owner.

## 5. Technologies

Existing Python face-processing service, InsightFace embeddings,
pgvector or another similarity-search approach, React + TypeScript and
PostgreSQL.

## 6. Development checklist

- [ ] Generate similarity-based face groups.
- [ ] Create an unknown-people screen.
- [ ] Show representative faces and related photographs.
- [ ] Let users confirm a person's name.
- [ ] Let users correct incorrect matches.
- [ ] Add merge and split controls.
- [ ] Display photographs for a confirmed person.
- [ ] Enforce ownership for every person and face record.
- [ ] Test with a small family/wedding collection.

## 7. When is Phase 5 complete?

- [ ] Similar faces can be grouped.
- [ ] Users can confirm names.
- [ ] Users can correct wrong groupings.
- [ ] A confirmed person opens their related photographs.
- [ ] The application never guesses family relationships.

**Deliverable:** Users can review and manage people groups in their own
photo library.

---

# Phase 6 --- Event & Ceremony Recognition

Intermediate level \| Target: 2--3 days for a first version

## 1. What are we building?

Help users organize photographs around events such as weddings,
birthdays, trips and celebrations. Start with wedding ceremonies: Haldi,
Mehendi, Sangeet, Varmala, Wedding and Reception.

AI suggestions must remain editable and reviewable.

## 2. Features to implement

---

No. Feature What it does

---

1 Event suggestions Suggest a possible
event from image
descriptions and visual
clues.

2 Ceremony labels Suggest wedding
ceremony categories.

3 Event creation Let users create
events.

4 Review suggestions Confirm or correct AI
labels.

5 Event gallery Display photographs
assigned to an event.

6 Multiple membership Allow one photo to
belong to multiple
events/collections.

---

## 3. Example

A photograph may be associated with Brother's Wedding, Haldi, Mother and
Brother. It can appear in both the Mother and Haldi collections.

## 4. Database changes

Possible tables: `events`, `event_types` or controlled labels,
`media_events` (many-to-many), and `media_labels` if reusable labels are
needed. Do not put only one `event_id` on `media_files` if a photo can
belong to multiple events.

## 5. Technologies

Existing image-analysis pipeline, one vision model or classifier,
PostgreSQL and React + TypeScript.

## 6. Development checklist

- [ ] Define initial event and ceremony labels.
- [ ] Generate event suggestions for sample images.
- [ ] Create an event management screen.
- [ ] Let users create and rename events.
- [ ] Let users assign photographs to events.
- [ ] Let users correct AI suggestions.
- [ ] Support one image belonging to multiple events.
- [ ] Build an event gallery.
- [ ] Test with mixed wedding photographs.

## 7. When is Phase 6 complete?

- [ ] Event suggestions are generated.
- [ ] Users can create and edit events.
- [ ] Users can assign and remove photographs.
- [ ] A photograph can belong to multiple events.
- [ ] Event galleries show the correct photographs.

**Deliverable:** Users can organize photographs by events and wedding
ceremonies.

---

# Phase 7 --- Personal Memory & Relationship Data Model

Intermediate level \| Target: 2--3 days for the first version

## 1. What are we building?

Connect files, people and events so the application can represent
meaningful relationships.

Example: a person appears in a photograph; the photograph belongs to a
wedding; the wedding happened on a particular date; the user confirmed
that the person is their father.

## 2. Features to implement

---

No. Feature What it does

---

1 Person relationships Save user-confirmed
relationships such as
Father or Friend.

2 Memory connections Link people, media and
events.

3 Dates and places Store known or
user-confirmed dates
and locations.

4 Source references Keep a link to the
original file behind
each fact.

5 User corrections Allow facts and
connections to be
edited or removed.

6 Privacy boundaries Scope every memory
record to its owner.

---

## 3. Example memory

`Mother → appears in → Photo 123 → belongs to → Haldi Event`

Store this as explicit relationships, not only as text in an
AI-generated description.

## 4. Database concepts

Start with only the tables needed for the first use cases: `people`,
`events`, `media_people`, `media_events`, `memory_facts` and optionally
`places`.

Every memory fact should have a source or indicate that it was
explicitly entered by the user.

## 5. Development checklist

- [ ] Define the first memory relationship types.
- [ ] Create tables for people/media/event connections.
- [ ] Save user-confirmed relationships.
- [ ] Link facts to their source media.
- [ ] Store dates and places only when known.
- [ ] Add edit and delete operations for facts.
- [ ] Add ownership checks to every query.
- [ ] Test that users cannot reference one another's records.

## 6. When is Phase 7 complete?

- [ ] People, events and photographs are connected.
- [ ] User-confirmed relationships are stored.
- [ ] Facts can be traced to their source.
- [ ] Users can correct and delete facts.
- [ ] Memory records remain private per user.

**Deliverable:** A structured personal memory layer connecting
photographs, people, events and facts.

---

# Phase 8 --- Search by Person, Event & Metadata

Beginner-to-intermediate level \| Target: 2--3 days

## 1. What are we building?

Make structured search useful before introducing conversational AI.
Users should find photographs using filters such as person, event, date
and labels.

## 2. Features to implement

---

No. Feature What it does

---

1 Search by person Find photographs of a
confirmed person.

2 Search by event Find photographs from
Haldi, Reception or
another event.

3 Date filtering Filter by upload date
or known event date.

4 Label filtering Find images with
selected visual labels.

5 Combined filters Combine person, event
and date filters.

6 Evidence links Open the original
photograph from a
result.

---

## 3. Example searches

- Show all photographs of Father.
- Show photographs from Haldi.
- Show Mother's photographs from Haldi.
- Show photographs from a selected date range.

## 4. Development checklist

- [ ] Create backend search endpoints.
- [ ] Add person filtering.
- [ ] Add event filtering.
- [ ] Add date filtering.
- [ ] Add label filtering.
- [ ] Support combining filters.
- [ ] Add frontend search and filter controls.
- [ ] Show results with original-file links.
- [ ] Add pagination for large collections.
- [ ] Test searches with multiple users and large result sets.

## 5. When is Phase 8 complete?

- [ ] Users can search by confirmed person.
- [ ] Users can search by event.
- [ ] Users can filter by date and labels.
- [ ] Combined filters return correct results.
- [ ] Results open the correct original files.

**Deliverable:** A useful structured photo search experience without
requiring a chatbot.

---

# Phase 9 --- AI Memory Search & Chat Assistant

Intermediate level \| Target: 2--3 days for a basic prototype

## 1. What are we building?

Let users ask questions in normal language instead of selecting filters
manually. The assistant translates a question into a search over the
user's structured memory and returns relevant photographs or facts.

Start with a small set of supported questions.

## 2. Features to implement

---

No. Feature What it does

---

1 Chat interface Allow users to ask
questions.

2 Intent extraction Identify person, event,
date or label in a
question.

3 Memory retrieval Search only the current
user's records.

4 Answer generation Explain retrieved
results naturally.

5 Evidence Show photographs or
records used for the
answer.

6 Uncertainty handling Say when information is
insufficient.

7 Follow-up context Support simple
follow-up questions.

---

## 3. Example

User: "Show me all pictures with my father from Haldi."

1.  Identify person = Father.
2.  Identify event = Haldi.
3.  Search the user's memory.
4.  Return matching photographs.
5.  Show original photographs as evidence.

## 4. Technologies

One LLM API, Node.js backend, PostgreSQL, existing memory/search
services and React chat UI. Use structured database queries first. Add
vector search only where it improves retrieval, such as semantic search
over image descriptions.

## 5. Development checklist

- [ ] Build a basic chat UI.
- [ ] Choose one LLM provider.
- [ ] Define a small set of supported question types.
- [ ] Convert questions into structured search parameters.
- [ ] Retrieve only the current user's records.
- [ ] Generate answers from retrieved evidence.
- [ ] Return original media references with answers.
- [ ] Handle no-result and uncertain cases.
- [ ] Add basic conversation history.
- [ ] Test known questions against expected results.

## 6. When is Phase 9 complete?

- [ ] Users can ask questions in natural language.
- [ ] Assistant retrieves relevant memory records.
- [ ] Answers include original-file evidence.
- [ ] Assistant does not invent missing facts.
- [ ] User data remains isolated.

**Deliverable:** A basic chat assistant that answers questions about
photo memories.

---

# Phase 10 --- Albums, Collections & Safe Actions

Intermediate level \| Target: 2--3 days for a first version

## 1. What are we building?

Move from finding memories to organizing them. Users can create albums
manually and ask the assistant to prepare a collection based on search
results. The assistant previews important changes and waits for
approval.

## 2. Features to implement

---

No. Feature What it does

---

1 Create albums Create named albums.

2 Add/remove photographs Manage album
membership.

3 AI collection proposal Prepare a collection
from a person/event
search.

4 Preview Show photographs that
will be added.

5 User approval Execute only after
confirmation.

6 Export Generate a downloadable
album or ZIP.

7 Safe deletion Confirm before
destructive operations.

---

## 3. Example

User: "Create an album of Mother's photographs from Haldi."

Assistant searches for Mother + Haldi, prepares a proposed collection,
shows the photographs and album name, asks for confirmation, then
creates the album after approval.

## 4. Database changes

Possible tables: `albums`, `album_media` (many-to-many), and an
`action_requests` or action log if approval tracking is needed.

## 5. Development checklist

- [ ] Create album tables.
- [ ] Build create, rename and delete album APIs.
- [ ] Add and remove photographs from albums.
- [ ] Build album gallery UI.
- [ ] Let the assistant prepare a collection proposal.
- [ ] Show a preview before making changes.
- [ ] Require confirmation for important actions.
- [ ] Generate a downloadable ZIP.
- [ ] Test ownership and authorization.

## 6. When is Phase 10 complete?

- [ ] Users can create and manage albums.
- [ ] A photograph can appear in multiple albums.
- [ ] AI can prepare a collection proposal.
- [ ] User approval is required before execution.
- [ ] Downloaded albums contain expected files.

**Deliverable:** Users can organize memories and approve AI-prepared
actions.

---

# Phase 11 --- Screenshots, PDFs & Document Intelligence

Intermediate level \| Target: 2--3 days for a basic workflow

## 1. What are we building?

Expand beyond photographs to screenshots, PDFs, receipts, tickets and
business cards. Extract text and useful fields, then make the
information searchable.

## 2. Features to implement

---

No. Feature What it does

---

1 Document uploads Accept selected
document formats.

2 Text extraction Extract text from PDFs
and images.

3 OCR Read text from
screenshots, receipts
and scanned documents.

4 Field extraction Suggest dates, amounts,
phone numbers and
names.

5 User review Allow users to correct
extracted fields.

6 Search Search extracted text
and fields.

7 Evidence Open the original
document or screenshot.

---

## 3. Example questions

- Find the phone number on this business card.
- Show my laptop receipt.
- What was the date of my last movie ticket?
- Find the booking confirmation screenshot.

## 4. Technologies

PaddleOCR or another OCR solution, a PDF text-extraction library, Python
processing service, PostgreSQL and an LLM for structured field
extraction where useful.

## 5. Development checklist

- [ ] Decide supported document formats.
- [ ] Extend upload validation safely.
- [ ] Add document-processing jobs.
- [ ] Extract text from PDFs.
- [ ] Run OCR on image-based documents.
- [ ] Extract a small set of useful fields.
- [ ] Store extracted text and fields with source references.
- [ ] Build a document review screen.
- [ ] Add search over extracted information.
- [ ] Test receipts, tickets, screenshots and business cards.

## 6. When is Phase 11 complete?

- [ ] Users can upload supported documents.
- [ ] Text is extracted successfully.
- [ ] Useful fields can be reviewed and corrected.
- [ ] Documents can be searched.
- [ ] Results link to original files.

**Deliverable:** A searchable personal document and screenshot library.

---

# Phase 12 --- Video & Audio Memory

Intermediate level \| Target: 2--3 days for a first prototype

## 1. What are we building?

Allow users to upload videos and audio recordings and extract searchable
information. Start with short test files; large media requires careful
size limits and background processing.

## 2. Features to implement

No. Feature What it does

---

1 Video upload Accept a limited set of video formats.
2 Audio upload Accept a limited set of audio formats.
3 Video metadata Read duration and technical information.
4 Audio transcription Convert speech into text.
5 Video keyframes Extract selected frames.
6 Searchable transcript Store transcript text with timestamps.
7 Source playback Link results to original media.

## 3. Technologies

FFmpeg, Whisper API or another speech-to-text service, BullMQ,
PostgreSQL and existing media storage.

## 4. Development checklist

- [ ] Define supported formats and size limits.
- [ ] Add validation for new media types.
- [ ] Add video/audio metadata extraction.
- [ ] Extract a few keyframes from a short video.
- [ ] Transcribe a short audio recording.
- [ ] Store transcript segments with timestamps.
- [ ] Display transcript and source playback.
- [ ] Add basic transcript search.
- [ ] Handle long files and processing failures.

## 5. When is Phase 12 complete?

- [ ] Short videos and audio files can be uploaded.
- [ ] Metadata is extracted.
- [ ] Audio can be transcribed.
- [ ] Video keyframes can be extracted.
- [ ] Transcripts link to source media.
- [ ] Processing runs in the background.

**Deliverable:** A basic searchable video and audio memory workflow.

---

# Phase 13 --- Voice Assistant

Intermediate level \| Target: 2--3 days for a basic prototype

## 1. What are we building?

Let users ask the same memory questions by speaking instead of typing.
Voice uses the existing memory retrieval and task system; it does not
need a separate memory engine.

## 2. Features to implement

---

No. Feature What it does

---

1 Voice input Capture a spoken
question.

2 Speech-to-text Convert speech into
text.

3 Memory search Send recognized text
through the existing
assistant.

4 Spoken response Read the answer aloud.

5 Confirmation Ask before important
actions.

6 Cancel/stop Let users stop playback
or cancel an action.

---

## 3. Technologies

Browser speech APIs or a speech-to-text provider, Whisper if needed, a
text-to-speech provider such as ElevenLabs or browser speech synthesis,
and existing chat/action services.

## 4. Development checklist

- [ ] Add a microphone control.
- [ ] Capture and transcribe a short question.
- [ ] Send recognized text to the existing assistant.
- [ ] Display recognized text for correction.
- [ ] Read the answer aloud.
- [ ] Add stop/cancel controls.
- [ ] Require explicit confirmation for important actions.
- [ ] Test noisy audio and transcription errors.

## 5. When is Phase 13 complete?

- [ ] Users can ask a question by voice.
- [ ] The same memory search system is used.
- [ ] Answers can be spoken aloud.
- [ ] Users can stop or cancel.
- [ ] Important actions still require confirmation.

**Deliverable:** A voice interface connected to the existing memory and
action system.

---

# Phase 14 --- Security, Reliability & Deployment

Intermediate level \| Target: 2--3 days for an initial deployment

## 1. What are we building?

Prepare the application for use outside local development. This phase
focuses on making the existing application safer, more reliable and
deployable---not adding new AI features.

## 2. Features to implement

---

No. Feature What it does

---

1 Production Separate development
configuration and production
settings.

2 Cloud storage Move originals from
local disk to private
object storage.

3 Secure access Enforce ownership
checks and private
media access.

4 Secrets management Keep credentials out of
source control.

5 Logging Record useful errors
and processing
failures.

6 Backups Back up database data
and define file
recovery.

7 Deployment Deploy frontend,
backend, worker and
database.

8 Monitoring Check application and
worker health.

---

## 3. Technologies to consider

Cloudflare R2 or another private object-storage service, Docker, AWS or
another hosting provider, managed PostgreSQL and Redis, secrets
management and structured logging.

Choose one deployment path instead of trying multiple cloud providers at
once.

## 4. Development checklist

- [ ] Audit authentication and ownership checks.
- [ ] Verify private files are not publicly exposed.
- [ ] Configure production environment variables.
- [ ] Remove secrets from the repository and rotate exposed
      credentials.
- [ ] Move files to private object storage.
- [ ] Update upload, read and delete flows for cloud storage.
- [ ] Configure database and Redis for deployment.
- [ ] Deploy frontend, API and worker.
- [ ] Add health checks and useful logs.
- [ ] Test upload, processing, search and deletion in production.
- [ ] Verify backup and recovery procedures.

## 5. When is Phase 14 complete?

- [ ] Application is deployed.
- [ ] User data remains isolated.
- [ ] Media files are private.
- [ ] Upload and processing work in production.
- [ ] Errors can be investigated from logs.
- [ ] Backups and recovery have been tested.

**Deliverable:** A deployed and more reliable version of the personal AI
memory assistant.

---

# Future Improvements --- Keep These Out of Early Phases

Add these after the relevant core workflow is stable:

- Larger-scale face clustering and performance improvements.
- Better event classification and timeline generation.
- Semantic search and multimodal embeddings.
- More document types and structured extraction.
- More advanced agent tools and task workflows.
- Calendar, email or other external integrations with explicit
  permissions.
- Shared family libraries and photographer/client workflows.
- Data export, account deletion and retention controls.
- Better observability, evaluation datasets and AI quality
  measurements.

---

# Overall Phase Checklist

Phase Milestone Status

---

1. Project Foundation & Media Upload Completed
2. Background Media Processing Foundation Not started
3. Image Understanding & Basic Visual Analysis Not started
4. Face Detection & Face Embeddings Not started
5. People Grouping & User Identity Confirmation Not started
6. Event & Ceremony Recognition Not started
7. Personal Memory & Relationship Data Model Not started
8. Search by Person, Event & Metadata Not started
9. AI Memory Search & Chat Assistant Not started
10. Albums, Collections & Safe Actions Not started
11. Screenshots, PDFs & Document Intelligence Not started
12. Video & Audio Memory Not started
13. Voice Assistant Not started
14. Security, Reliability & Deployment Not started

## Recommended next step

Start with **Phase 2 --- Background Media Processing Foundation**.

Do not start face recognition yet. First make sure an uploaded image can
enter a queue, be processed by a separate worker, generate a thumbnail
and update its status reliably. Later AI features can reuse that
pipeline instead of putting heavy processing inside upload APIs.

**Product principle:** Build one reliable capability at a time. Memora
AI should not merely store files or generate descriptions; it should
build trustworthy, user-controlled connections between files, people,
events and useful actions.
