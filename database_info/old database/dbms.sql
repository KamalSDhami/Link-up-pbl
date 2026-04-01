-- Enable required extension for gen_random_uuid() CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ENUM types DO 
B
E
G
I
N
I
F
N
O
T
E
X
I
S
T
S
(
S
E
L
E
C
T
1
F
R
O
M
p
g
t
y
p
e
W
H
E
R
E
t
y
p
n
a
m
e
=
′
p
r
e
f
e
r
r
e
d
g
e
n
d
e
r
e
n
u
m
′
)
T
H
E
N
C
R
E
A
T
E
T
Y
P
E
p
r
e
f
e
r
r
e
d
g
e
n
d
e
r
e
n
u
m
A
S
E
N
U
M
(
′
m
a
l
e
′
,
′
f
e
m
a
l
e
′
,
′
a
n
y
′
)
;
E
N
D
I
F
;
I
F
N
O
T
E
X
I
S
T
S
(
S
E
L
E
C
T
1
F
R
O
M
p
g
t
y
p
e
W
H
E
R
E
t
y
p
n
a
m
e
=
′
e
v
e
n
t
s
t
a
t
u
s
e
n
u
m
′
)
T
H
E
N
C
R
E
A
T
E
T
Y
P
E
e
v
e
n
t
s
t
a
t
u
s
e
n
u
m
A
S
E
N
U
M
(
′
d
r
a
f
t
′
,
′
s
c
h
e
d
u
l
e
d
′
,
′
l
i
v
e
′
,
′
e
n
d
e
d
′
,
′
c
a
n
c
e
l
l
e
d
′
)
;
E
N
D
I
F
;
I
F
N
O
T
E
X
I
S
T
S
(
S
E
L
E
C
T
1
F
R
O
M
p
g
t
y
p
e
W
H
E
R
E
t
y
p
n
a
m
e
=
′
e
v
e
n
t
r
e
g
i
s
t
r
a
t
i
o
n
t
y
p
e
e
n
u
m
′
)
T
H
E
N
C
R
E
A
T
E
T
Y
P
E
e
v
e
n
t
r
e
g
i
s
t
r
a
t
i
o
n
t
y
p
e
e
n
u
m
A
S
E
N
U
M
(
′
r
e
g
i
s
t
r
a
t
i
o
n
r
e
q
u
i
r
e
d
′
,
′
o
p
e
n
′
)
;
E
N
D
I
F
;
I
F
N
O
T
E
X
I
S
T
S
(
S
E
L
E
C
T
1
F
R
O
M
p
g
t
y
p
e
W
H
E
R
E
t
y
p
n
a
m
e
=
′
e
v
e
n
t
r
e
g
i
s
t
r
a
t
i
o
n
f
l
o
w
e
n
u
m
′
)
T
H
E
N
C
R
E
A
T
E
T
Y
P
E
e
v
e
n
t
r
e
g
i
s
t
r
a
t
i
o
n
f
l
o
w
e
n
u
m
A
S
E
N
U
M
(
′
a
u
t
o
a
p
p
r
o
v
a
l
′
,
′
f
o
r
m
r
e
v
i
e
w
′
)
;
E
N
D
I
F
;
I
F
N
O
T
E
X
I
S
T
S
(
S
E
L
E
C
T
1
F
R
O
M
p
g
t
y
p
e
W
H
E
R
E
t
y
p
n
a
m
e
=
′
e
v
e
n
t
p
o
l
l
m
o
d
e
e
n
u
m
′
)
T
H
E
N
C
R
E
A
T
E
T
Y
P
E
e
v
e
n
t
p
o
l
l
m
o
d
e
e
n
u
m
A
S
E
N
U
M
(
′
s
i
n
g
l
e
c
h
o
i
c
e
′
,
′
m
u
l
t
i
p
l
e
c
h
o
i
c
e
′
)
;
E
N
D
I
F
;
I
F
N
O
T
E
X
I
S
T
S
(
S
E
L
E
C
T
1
F
R
O
M
p
g
t
y
p
e
W
H
E
R
E
t
y
p
n
a
m
e
=
′
e
v
e
n
t
r
e
g
i
s
t
r
a
t
i
o
n
s
t
a
t
u
s
e
n
u
m
′
)
T
H
E
N
C
R
E
A
T
E
T
Y
P
E
e
v
e
n
t
r
e
g
i
s
t
r
a
t
i
o
n
s
t
a
t
u
s
e
n
u
m
A
S
E
N
U
M
(
′
p
e
n
d
i
n
g
′
,
′
a
p
p
r
o
v
e
d
′
,
′
w
a
i
t
l
i
s
t
e
d
′
,
′
r
e
j
e
c
t
e
d
′
,
′
c
a
n
c
e
l
l
e
d
′
)
;
E
N
D
I
F
;
I
F
N
O
T
E
X
I
S
T
S
(
S
E
L
E
C
T
1
F
R
O
M
p
g
t
y
p
e
W
H
E
R
E
t
y
p
n
a
m
e
=
′
g
e
n
d
e
r
e
n
u
m
′
)
T
H
E
N
C
R
E
A
T
E
T
Y
P
E
g
e
n
d
e
r
e
n
u
m
A
S
E
N
U
M
(
′
m
a
l
e
′
,
′
f
e
m
a
l
e
′
,
′
n
o
n
b
i
n
a
r
y
′
,
′
p
r
e
f
e
r
n
o
t
t
o
s
a
y
′
,
′
o
t
h
e
r
′
)
;
E
N
D
I
F
;
E
N
D
BEGINIFNOTEXISTS(SELECT1FROMpg 
t
​
 ypeWHEREtypname= 
′
 preferred 
g
​
 ender 
e
​
 num 
′
 )THENCREATETYPEpreferred 
g
​
 ender 
e
​
 numASENUM( 
′
 male 
′
 , 
′
 female 
′
 , 
′
 any 
′
 );ENDIF;IFNOTEXISTS(SELECT1FROMpg 
t
​
 ypeWHEREtypname= 
′
 event 
s
​
 tatus 
e
​
 num 
′
 )THENCREATETYPEevent 
s
​
 tatus 
e
​
 numASENUM( 
′
 draft 
′
 , 
′
 scheduled 
′
 , 
′
 live 
′
 , 
′
 ended 
′
 , 
′
 cancelled 
′
 );ENDIF;IFNOTEXISTS(SELECT1FROMpg 
t
​
 ypeWHEREtypname= 
′
 event 
r
​
 egistration 
t
​
 ype 
e
​
 num 
′
 )THENCREATETYPEevent 
r
​
 egistration 
t
​
 ype 
e
​
 numASENUM( 
′
 registration 
r
​
 equired 
′
 , 
′
 open 
′
 );ENDIF;IFNOTEXISTS(SELECT1FROMpg 
t
​
 ypeWHEREtypname= 
′
 event 
r
​
 egistration 
f
​
 low 
e
​
 num 
′
 )THENCREATETYPEevent 
r
​
 egistration 
f
​
 low 
e
​
 numASENUM( 
′
 auto 
a
​
 pproval 
′
 , 
′
 form 
r
​
 eview 
′
 );ENDIF;IFNOTEXISTS(SELECT1FROMpg 
t
​
 ypeWHEREtypname= 
′
 event 
p
​
 oll 
m
​
 ode 
e
​
 num 
′
 )THENCREATETYPEevent 
p
​
 oll 
m
​
 ode 
e
​
 numASENUM( 
′
 single 
c
​
 hoice 
′
 , 
′
 multiple 
c
​
 hoice 
′
 );ENDIF;IFNOTEXISTS(SELECT1FROMpg 
t
​
 ypeWHEREtypname= 
′
 event 
r
​
 egistration 
s
​
 tatus 
e
​
 num 
′
 )THENCREATETYPEevent 
r
​
 egistration 
s
​
 tatus 
e
​
 numASENUM( 
′
 pending 
′
 , 
′
 approved 
′
 , 
′
 waitlisted 
′
 , 
′
 rejected 
′
 , 
′
 cancelled 
′
 );ENDIF;IFNOTEXISTS(SELECT1FROMpg 
t
​
 ypeWHEREtypname= 
′
 gender 
e
​
 num 
′
 )THENCREATETYPEgender 
e
​
 numASENUM( 
′
 male 
′
 , 
′
 female 
′
 , 
′
 non 
b
​
 inary 
′
 , 
′
 prefer 
n
​
 ot 
t
​
 o 
s
​
 ay 
′
 , 
′
 other 
′
 );ENDIF;END;

-- Table: users CREATE TABLE IF NOT EXISTS public.users ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE, name text, profile_picture_url text, section text, year integer CHECK (year >= 1 AND year <= 4), skills text[] DEFAULT '{}'::text[], github_url text, linkedin_url text, social_visibility text DEFAULT 'on_application'::text CHECK (social_visibility = ANY (ARRAY['always'::text, 'on_application'::text, 'hidden'::text])), gehu_verified boolean DEFAULT false, gehu_email text UNIQUE, role text DEFAULT 'student'::text CHECK (role = ANY (ARRAY['student'::text, 'moderator'::text, 'super_admin'::text, 'event_manager'::text, 'god'::text])), is_banned boolean DEFAULT false, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), search_vector tsvector, gender gender_enum DEFAULT 'prefer_not_to_say'::gender_enum );

-- Table: teams CREATE TABLE IF NOT EXISTS public.teams ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, description text, year integer NOT NULL CHECK (year >= 1 AND year <= 4), leader_id uuid NOT NULL, is_full boolean DEFAULT false, member_count integer DEFAULT 1 CHECK (member_count >= 1 AND member_count <= 4), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), purpose text DEFAULT 'pbl'::text CHECK (purpose = ANY (ARRAY['hackathon'::text, 'college_event'::text, 'pbl'::text, 'other'::text])), max_size integer DEFAULT 4 CHECK (max_size >= 1 AND max_size <= 10) );

-- Table: team_members CREATE TABLE IF NOT EXISTS public.team_members ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid NOT NULL, user_id uuid NOT NULL, joined_at timestamptz DEFAULT now() );

-- Table: recruitment_posts CREATE TABLE IF NOT EXISTS public.recruitment_posts ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid NOT NULL, posted_by uuid NOT NULL, title text NOT NULL, description text NOT NULL, required_skills text[] DEFAULT '{}'::text[], positions_available integer DEFAULT 1 CHECK (positions_available > 0), status text DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'closed'::text, 'archived'::text])), created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), search_vector tsvector, expires_at timestamptz DEFAULT (now() + '48:00:00'::interval), preferred_gender preferred_gender_enum DEFAULT 'any'::preferred_gender_enum );

-- Table: applications CREATE TABLE IF NOT EXISTS public.applications ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recruitment_post_id uuid NOT NULL, applicant_id uuid NOT NULL, message text, status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])), applied_at timestamptz DEFAULT now(), reviewed_at timestamptz );

-- Table: chatrooms CREATE TABLE IF NOT EXISTS public.chatrooms ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), type text NOT NULL CHECK (type = ANY (ARRAY['dm'::text, 'team'::text, 'recruitment'::text, 'group'::text])), team_id uuid, recruitment_post_id uuid, name text, created_at timestamptz DEFAULT now(), archived boolean DEFAULT false );

-- Table: chatroom_members CREATE TABLE IF NOT EXISTS public.chatroom_members ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chatroom_id uuid NOT NULL, user_id uuid NOT NULL, joined_at timestamptz DEFAULT now(), last_read_at timestamptz DEFAULT now() );

-- Table: messages CREATE TABLE IF NOT EXISTS public.messages ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chatroom_id uuid NOT NULL, sender_id uuid NOT NULL, content text NOT NULL, created_at timestamptz DEFAULT now(), edited_at timestamptz, deleted boolean DEFAULT false, reply_to_message_id uuid, forwarded_from_message_id uuid );

-- Table: events CREATE TABLE IF NOT EXISTS public.events ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text, event_type text CHECK (event_type = ANY (ARRAY['hackathon'::text, 'workshop'::text, 'seminar'::text, 'competition'::text, 'meetup'::text, 'other'::text])), start_at timestamptz NOT NULL, end_at timestamptz, location text, created_by uuid, max_participants integer, registration_closes_at timestamptz, status event_status_enum DEFAULT 'draft'::event_status_enum, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), slug text UNIQUE, summary text, event_mode text DEFAULT 'in_person'::text CHECK (event_mode = ANY (ARRAY['in_person'::text, 'online'::text, 'hybrid'::text])), visibility text DEFAULT 'campus'::text CHECK (visibility = ANY (ARRAY['public'::text, 'campus'::text])), banner_url text, meeting_link text, registration_type event_registration_type_enum DEFAULT 'registration_required'::event_registration_type_enum, registration_flow event_registration_flow_enum DEFAULT 'auto_approval'::event_registration_flow_enum, registration_opens_at timestamptz, requires_gehu_verification boolean DEFAULT true, allow_waitlist boolean DEFAULT true, auto_close boolean DEFAULT true, published_at timestamptz );

-- Table: reports CREATE TABLE IF NOT EXISTS public.reports ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reporter_id uuid NOT NULL, reported_user_id uuid, reported_team_id uuid, reported_recruitment_id uuid, reported_message_id uuid, reason text NOT NULL, description text, status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'resolved'::text, 'dismissed'::text])), reviewed_by uuid, created_at timestamptz DEFAULT now(), reviewed_at timestamptz );

-- Table: verification_codes CREATE TABLE IF NOT EXISTS public.verification_codes ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, code text NOT NULL, gehu_email text NOT NULL, expires_at timestamptz NOT NULL, verified boolean DEFAULT false, created_at timestamptz DEFAULT now() );

-- Table: notifications CREATE TABLE IF NOT EXISTS public.notifications ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, type text NOT NULL CHECK (type = ANY (ARRAY['application'::text, 'team_invite'::text, 'message'::text, 'system'::text, 'event'::text])), title text NOT NULL, message text NOT NULL, link text, read boolean DEFAULT false, created_at timestamptz DEFAULT now() );

-- Table: verification_otps CREATE TABLE IF NOT EXISTS public.verification_otps ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, email text NOT NULL, otp text NOT NULL, expires_at timestamptz NOT NULL, verified boolean DEFAULT false, created_at timestamptz DEFAULT now() );

-- Table: team_join_requests CREATE TABLE IF NOT EXISTS public.team_join_requests ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid NOT NULL, requester_id uuid NOT NULL, status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])), message text, created_at timestamptz DEFAULT now(), reviewed_at timestamptz );

-- Table: contacts CREATE TABLE IF NOT EXISTS public.contacts ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, contact_id uuid NOT NULL, alias text, favorite boolean DEFAULT false, created_at timestamptz DEFAULT now() );

-- Table: friend_requests CREATE TABLE IF NOT EXISTS public.friend_requests ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sender_id uuid NOT NULL, receiver_id uuid NOT NULL, status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'blocked'::text])), message text, created_at timestamptz DEFAULT now(), responded_at timestamptz );

-- Table: chatroom_roles CREATE TABLE IF NOT EXISTS public.chatroom_roles ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chatroom_id uuid NOT NULL, user_id uuid NOT NULL, role text DEFAULT 'member'::text CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'moderator'::text, 'member'::text])), can_post boolean DEFAULT true, can_manage_members boolean DEFAULT false, can_manage_messages boolean DEFAULT false, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now() );

-- Table: chatroom_mutes CREATE TABLE IF NOT EXISTS public.chatroom_mutes ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chatroom_id uuid NOT NULL, user_id uuid NOT NULL, muted_until timestamptz, reason text, created_by uuid NOT NULL, created_at timestamptz DEFAULT now() );

-- Table: message_reactions CREATE TABLE IF NOT EXISTS public.message_reactions ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), message_id uuid NOT NULL, user_id uuid NOT NULL, reaction text NOT NULL, created_at timestamptz DEFAULT now() );

-- Table: message_reports CREATE TABLE IF NOT EXISTS public.message_reports ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), message_id uuid NOT NULL, reporter_id uuid NOT NULL, reason text NOT NULL, created_at timestamptz DEFAULT now(), status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'reviewing'::text, 'resolved'::text])), reviewer_id uuid, reviewed_at timestamptz, decrypted_preview text );

-- Table: account_deactivation_requests CREATE TABLE IF NOT EXISTS public.account_deactivation_requests ( user_id uuid PRIMARY KEY, scheduled_for timestamptz, created_at timestamptz DEFAULT now() );

-- Table: event_forms CREATE TABLE IF NOT EXISTS public.event_forms ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid UNIQUE NOT NULL, title text DEFAULT 'Registration Form'::text, description text, form_schema jsonb, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now() );

-- Table: event_registrations CREATE TABLE IF NOT EXISTS public.event_registrations ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL, user_id uuid NOT NULL, status event_registration_status_enum DEFAULT 'pending'::event_registration_status_enum, answers jsonb, submitted_at timestamptz DEFAULT now(), reviewed_at timestamptz, reviewed_by uuid, cancellation_reason text, waitlist_position integer );

-- Table: event_polls CREATE TABLE IF NOT EXISTS public.event_polls ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL, question text NOT NULL, description text, mode event_poll_mode_enum DEFAULT 'single_choice'::event_poll_mode_enum, is_anonymous boolean DEFAULT true, is_published boolean DEFAULT false, opens_at timestamptz, closes_at timestamptz, created_by uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now() );

-- Table: event_poll_options CREATE TABLE IF NOT EXISTS public.event_poll_options ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), poll_id uuid NOT NULL, label text NOT NULL, description text, sort_order integer DEFAULT 0, created_at timestamptz DEFAULT now() );

-- Table: event_poll_votes CREATE TABLE IF NOT EXISTS public.event_poll_votes ( id uuid PRIMARY KEY DEFAULT gen_random_uuid(), poll_id uuid NOT NULL, option_id uuid NOT NULL, user_id uuid NOT NULL, voted_at timestamptz DEFAULT now() );

-- Table: system_settings CREATE TABLE IF NOT EXISTS public.system_settings ( key text PRIMARY KEY, category text, description text, value jsonb DEFAULT 'null'::jsonb, updated_at timestamptz DEFAULT now(), updated_by uuid );

-- Foreign keys ALTER TABLE IF EXISTS public.team_members ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams (id);

ALTER TABLE IF EXISTS public.team_members ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.recruitment_posts ADD CONSTRAINT recruitment_posts_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams (id);

ALTER TABLE IF EXISTS public.recruitment_posts ADD CONSTRAINT recruitment_posts_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.applications ADD CONSTRAINT applications_recruitment_post_id_fkey FOREIGN KEY (recruitment_post_id) REFERENCES public.recruitment_posts (id);

ALTER TABLE IF EXISTS public.applications ADD CONSTRAINT applications_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.chatrooms ADD CONSTRAINT chatrooms_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams (id);

ALTER TABLE IF EXISTS public.chatrooms ADD CONSTRAINT chatrooms_recruitment_post_id_fkey FOREIGN KEY (recruitment_post_id) REFERENCES public.recruitment_posts (id);

ALTER TABLE IF EXISTS public.chatroom_members ADD CONSTRAINT chatroom_members_chatroom_id_fkey FOREIGN KEY (chatroom_id) REFERENCES public.chatrooms (id);

ALTER TABLE IF EXISTS public.chatroom_members ADD CONSTRAINT chatroom_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.messages ADD CONSTRAINT messages_chatroom_id_fkey FOREIGN KEY (chatroom_id) REFERENCES public.chatrooms (id);

ALTER TABLE IF EXISTS public.messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.messages ADD CONSTRAINT messages_reply_to_message_id_fkey FOREIGN KEY (reply_to_message_id) REFERENCES public.messages (id);

ALTER TABLE IF EXISTS public.messages ADD CONSTRAINT messages_forwarded_from_message_id_fkey FOREIGN KEY (forwarded_from_message_id) REFERENCES public.messages (id);

ALTER TABLE IF EXISTS public.events ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.event_forms ADD CONSTRAINT event_forms_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events (id);

ALTER TABLE IF EXISTS public.event_registrations ADD CONSTRAINT event_registrations_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events (id);

ALTER TABLE IF EXISTS public.event_registrations ADD CONSTRAINT event_registrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.event_registrations ADD CONSTRAINT event_registrations_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.event_polls ADD CONSTRAINT event_polls_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events (id);

ALTER TABLE IF EXISTS public.event_polls ADD CONSTRAINT event_polls_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.event_poll_options ADD CONSTRAINT event_poll_options_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.event_polls (id);

ALTER TABLE IF EXISTS public.event_poll_votes ADD CONSTRAINT event_poll_votes_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.event_polls (id);

ALTER TABLE IF EXISTS public.event_poll_votes ADD CONSTRAINT event_poll_votes_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.event_poll_options (id);

ALTER TABLE IF EXISTS public.event_poll_votes ADD CONSTRAINT event_poll_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.reports ADD CONSTRAINT reports_reported_team_id_fkey FOREIGN KEY (reported_team_id) REFERENCES public.teams (id);

ALTER TABLE IF EXISTS public.reports ADD CONSTRAINT reports_reported_message_id_fkey FOREIGN KEY (reported_message_id) REFERENCES public.messages (id);

ALTER TABLE IF EXISTS public.reports ADD CONSTRAINT reports_reported_recruitment_id_fkey FOREIGN KEY (reported_recruitment_id) REFERENCES public.recruitment_posts (id);

ALTER TABLE IF EXISTS public.verification_otps ADD CONSTRAINT verification_otps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.team_join_requests ADD CONSTRAINT team_join_requests_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams (id);

ALTER TABLE IF EXISTS public.team_join_requests ADD CONSTRAINT team_join_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.contacts ADD CONSTRAINT contacts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.contacts ADD CONSTRAINT contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.friend_requests ADD CONSTRAINT friend_requests_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.friend_requests ADD CONSTRAINT friend_requests_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.chatroom_roles ADD CONSTRAINT chatroom_roles_chatroom_id_fkey FOREIGN KEY (chatroom_id) REFERENCES public.chatrooms (id);

ALTER TABLE IF EXISTS public.chatroom_roles ADD CONSTRAINT chatroom_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.chatroom_mutes ADD CONSTRAINT chatroom_mutes_chatroom_id_fkey FOREIGN KEY (chatroom_id) REFERENCES public.chatrooms (id);

ALTER TABLE IF EXISTS public.chatroom_mutes ADD CONSTRAINT chatroom_mutes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.chatroom_mutes ADD CONSTRAINT chatroom_mutes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.message_reactions ADD CONSTRAINT message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages (id);

ALTER TABLE IF EXISTS public.message_reactions ADD CONSTRAINT message_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.message_reports ADD CONSTRAINT message_reports_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages (id);

ALTER TABLE IF EXISTS public.message_reports ADD CONSTRAINT message_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.message_reports ADD CONSTRAINT message_reports_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.account_deactivation_requests ADD CONSTRAINT account_deactivation_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users (id);

ALTER TABLE IF EXISTS public.recruitment_posts ADD CONSTRAINT recruitment_posts_posted_by_fkey_2 FOREIGN KEY (posted_by) REFERENCES public.users (id);

-- Enable Row Level Security for tables that reported RLS enabled ALTER TABLE IF EXISTS public.teams ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.team_members ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.recruitment_posts ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.applications ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.chatrooms ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.chatroom_members ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.events ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.reports ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.verification_codes ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.verification_otps ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.team_join_requests ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.contacts ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.friend_requests ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.chatroom_roles ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.chatroom_mutes ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.message_reactions ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.message_reports ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.account_deactivation_requests ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.event_forms ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.event_registrations ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.event_polls ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.event_poll_options ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.event_poll_votes ENABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;

-- Indexes (recommendations / inferred) CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email); CREATE INDEX IF NOT EXISTS idx_users_gehu_email ON public.users (gehu_email); CREATE INDEX IF NOT EXISTS idx_users_search_vector ON public.users USING GIN (search_vector); CREATE INDEX IF NOT EXISTS idx_recruitment_posts_search_vector ON public.recruitment_posts USING GIN (search_vector); CREATE INDEX IF NOT EXISTS idx_messages_chatroom_id ON public.messages (chatroom_id); CREATE INDEX IF NOT EXISTS idx_chatroom_members_chatroom_id ON public.chatroom_members (chatroom_id); CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members (team_id); CREATE INDEX IF NOT EXISTS idx_event_registrations_event_id ON public.event_registrations (event_id);