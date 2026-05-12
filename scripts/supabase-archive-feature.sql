-- Run this in the Supabase SQL Editor to add the archiving feature
ALTER TABLE public.pengajuan_campaign 
ADD COLUMN is_archived BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN public.pengajuan_campaign.is_archived IS 'If true, campaign is hidden from main lists but still accessible directly';
