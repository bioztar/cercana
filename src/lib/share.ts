import { Platform, Share } from 'react-native';

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

type WebNav = {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

/** OS share sheet on native; navigator.share on web, falling back to copying the link. */
export async function shareInvite(url: string, patientName: string): Promise<ShareResult> {
  const message = `Join ${patientName}'s family on Cercana: ${url}`;
  try {
    if (Platform.OS !== 'web') {
      const res = await Share.share({ message });
      return res.action === Share.sharedAction ? 'shared' : 'cancelled';
    }
    const nav = (globalThis as { navigator?: WebNav }).navigator;
    if (nav?.share) {
      try {
        await nav.share({ title: 'Cercana', text: message, url });
        return 'shared';
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return 'cancelled';
        // any other failure: fall through to copying
      }
    }
    if (nav?.clipboard) {
      await nav.clipboard.writeText(url);
      return 'copied';
    }
    return 'failed';
  } catch (e) {
    console.warn('share failed', e);
    return 'failed';
  }
}

export const shareResultText = (r: ShareResult): string | null =>
  r === 'copied' ? 'Link copied. Paste it in a message.' : r === 'failed' ? 'Could not share. Copy the code instead.' : null;
