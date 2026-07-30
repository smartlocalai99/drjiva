create table public.document_hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null unique,
  created_at timestamptz not null default now()
);

alter table public.document_hospitals enable row level security;

create policy "Authenticated users can read document hospitals"
on public.document_hospitals
for select
to authenticated
using (true);

grant select on public.document_hospitals to authenticated;

insert into public.document_hospitals (sort_order, name)
values
  (1, 'RIMS / Government General Hospital'),
  (2, 'Government Super Speciality Hospital'),
  (3, 'Palla Hospitals'),
  (4, 'Asian Multi Speciality Hospitals'),
  (5, 'Vedanta Hospitals'),
  (6, 'Pulse Hospitals'),
  (7, 'Arjun Hospital'),
  (8, 'Arunachala Institute of Medical Sciences - AIMS Hospital'),
  (9, 'Prime Hospitals'),
  (10, 'Sri Sri Holistic Hospitals'),
  (11, 'Himalaya Multi Speciality Hospital'),
  (12, 'Surya Hospital'),
  (13, 'Kadapa Hospitals - KCH'),
  (14, 'Remedy Multi Speciality Hospital'),
  (15, 'Suraksha Super Specialty Hospital'),
  (16, 'Sree Hospital'),
  (17, 'Vidya Sagar Hospital'),
  (18, 'Bharathi Hospital'),
  (19, 'Karthikeya Hospital'),
  (20, 'Mrudula Hospital'),
  (21, 'Sri Lakshmi Hospital'),
  (22, 'Sree Harshitha Hospital'),
  (23, 'Kings Hospital'),
  (24, 'Sri Krishna Sahithi Eye Hospital'),
  (25, 'Swetha Hospital'),
  (26, 'Sri Venkateswara Hospital'),
  (27, 'Ashwini Hospital / Aswani Hospital'),
  (28, 'Ishaan Children''s Hospital'),
  (29, 'Chennai Children Hospital'),
  (30, 'Sri Sai Nursing Home'),
  (31, 'Vurimi Savithramma Hospital'),
  (32, 'Dr Dinesh Gastro Liver and Endoscopy Centre'),
  (33, 'Uma Maheswari Hospital'),
  (34, 'Syamala Hospital'),
  (35, 'Vijaya ENT and Child Care Hospital'),
  (36, 'Sri Bindu Hospital'),
  (37, 'M.M. Hospital'),
  (38, 'Sri Srinivasa Hospital'),
  (39, 'Sai Srinivasa Hospital'),
  (40, 'Ameen Multi Speciality Hospital'),
  (41, 'Bhudhav Hospital'),
  (42, 'Chaitanya Hospital'),
  (43, 'Cure Hospitals'),
  (44, 'Gajjala Maternity Hospital'),
  (45, 'Balaji Nursing Home'),
  (46, 'Deepa Nursing Home'),
  (47, 'Mallika Hospital'),
  (48, 'Sri Balaji Multispeciality and Maternity Hospital'),
  (49, 'Sunrise Hospital'),
  (50, 'Leelavathi Ortho Care'),
  (51, 'Rama''s Sreekara Multispeciality Hospital'),
  (52, 'Sree Mohan Hospital'),
  (53, 'Tirumala Hospitals'),
  (54, 'Dr S. Mahaboob Basha Surgical Hospital and Gastro-Laparoscopic Centre'),
  (55, 'Aravind Eye Care Center'),
  (56, 'GRKR Multispeciality Hospital'),
  (57, 'GSR Heart Care Center'),
  (58, 'Kadapa Diabetes Center and Specialities'),
  (59, 'Kammineni Neuro Care'),
  (60, 'Karthikeya Children''s Hospital'),
  (61, 'Khaleel Nursing Home'),
  (62, 'Little Hearts Children Hospital'),
  (63, 'Mamilla Naga Prasad Neuro Care'),
  (64, 'Medicare Hospital'),
  (65, 'Palla Krishnaiah Memorial Nursing Home'),
  (66, 'Pasupuleti Nursing Home'),
  (67, 'Preetham Hospital'),
  (68, 'S.V.S. Hospital'),
  (69, 'Sai Prasuna Nursing Home'),
  (70, 'Saigeetha Neuro Maternity Hospital'),
  (71, 'Shahid Hospitals'),
  (72, 'Siva Reddy Children''s Hospital'),
  (73, 'Sree Durga Hospital'),
  (74, 'SreeRam Hospital'),
  (75, 'Sri Balaji Hospital'),
  (76, 'Jyothi Nursing Home'),
  (77, 'R.R. Hospital'),
  (78, 'K.C.M. Hospital / Abhishek Kidney and General Hospital'),
  (79, 'Ashwini Children''s Hospital'),
  (80, 'Dr Noori''s Hospitals');

alter table public.patient_reports
  add column document_hospital_id uuid
    references public.document_hospitals(id)
    on delete restrict;

create index patient_reports_document_hospital_created_idx
  on public.patient_reports (document_hospital_id, created_at desc);
