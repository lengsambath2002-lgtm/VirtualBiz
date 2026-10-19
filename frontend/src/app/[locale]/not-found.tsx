import { FeedbackScreen, NotFoundView } from '@/components/feedback';

/** 404 for anything under a locale that no surface claims (each surface has its own too). */
export default function LocaleNotFound() {
  return (
    <FeedbackScreen>
      <NotFoundView />
    </FeedbackScreen>
  );
}
