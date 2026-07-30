alter table public.patient_reports
  drop constraint if exists patient_reports_report_type_check,
  add constraint patient_reports_report_type_check
    check (
      report_type is null
      or report_type in (
        'Prescription',
        'OP Consultation',
        'Lab Report',
        'Imaging',
        'Discharge Summary',
        'Medical Bill',
        'Other'
      )
    );
