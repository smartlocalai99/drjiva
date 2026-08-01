update public.order_dashboard_config
set vapid_public_key = 'BJoqPpvWvYTkOYKeEs1eLQRIU5gh-amp2fSRD3W7BoVCK3x-1tYZ-GtRi4IQaafz63Lrz2ivDQqu1HFpaF-3LhE',
    updated_at = now()
where singleton;
