// Client-only loader for Google Identity Services (GSI) — the modern
// "Sign in with Google" flow. Deliberately renders Google's own button
// (via accounts.id.renderButton) rather than a custom-styled look-alike:
// Google's brand guidelines require using their actual widget, and a
// DOM-clicking hack to trigger it from a custom button is the kind of thing
// that silently breaks the moment Google changes internal markup.
//
// The script tag and the id token it hands back are the whole flow — no
// redirect, no client_secret, nothing for a SPA to leak. Verification of
// the returned credential happens server-side (see backend's
// GoogleOAuthService); this composable's job ends at handing that string
// to whoever asked for it.
let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    if (document.querySelector('script[data-gsi]')) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.gsi = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Sign-In. Check your connection and try again.'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

interface GoogleIdConfig {
  client_id: string
  callback: (response: { credential: string }) => void
}
interface GoogleButtonConfig {
  type: 'standard'
  theme: 'outline'
  size: 'large'
  shape: 'pill'
  text: 'continue_with'
  logo_alignment: 'left'
  width?: number
}
interface GoogleAccountsId {
  initialize(config: GoogleIdConfig): void
  renderButton(el: HTMLElement, config: GoogleButtonConfig): void
}

export function useGoogleIdentity() {
  const config = useRuntimeConfig()
  const clientId = config.public.googleClientId as string

  async function renderButton(
    el: HTMLElement,
    onCredential: (idToken: string) => void,
    onError?: (message: string) => void
  ) {
    if (!clientId) return
    try {
      await loadScript()
    } catch (err: any) {
      onError?.(err.message)
      return
    }
    const accountsId = (window as any).google?.accounts?.id as GoogleAccountsId | undefined
    if (!accountsId) {
      onError?.('Google Sign-In failed to load')
      return
    }
    // Re-initializing on every call (rather than gating behind a one-time
    // flag) matters: it's what keeps `callback` bound to *this* mount's
    // closure rather than whichever mount happened to initialize first.
    accountsId.initialize({
      client_id: clientId,
      callback: (response) => onCredential(response.credential),
    })
    accountsId.renderButton(el, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      logo_alignment: 'left',
      width: el.clientWidth || undefined,
    })
  }

  return { clientId, renderButton }
}
