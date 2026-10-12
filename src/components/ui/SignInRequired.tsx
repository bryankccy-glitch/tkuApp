import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { Button } from './Button';
import { t } from '@/i18n/t';

/** Shown in place of account-only features (friends, 二手市集) in 本機/訪客模式. */
export function SignInRequired({ title, body }: { title: string; body: string }) {
  const { cloudAvailable, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center rounded-lg border border-line bg-surface px-6 py-10 text-center">
      <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <LogIn className="h-6 w-6" />
      </span>
      <p className="mt-4 text-h3 text-ink">{title}</p>
      <p className="mt-1 max-w-xs text-caption text-muted">{body}</p>
      {cloudAvailable ? (
        <Button className="mt-5" onClick={() => { void signOut().then(() => navigate('/login')); }}>
          <LogIn className="h-4 w-4" />{t('me.signInToSync')}
        </Button>
      ) : (
        <p className="mt-4 text-label text-muted">{t('social.cloudNotConfigured')}</p>
      )}
    </div>
  );
}
