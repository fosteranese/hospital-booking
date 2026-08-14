// Client-only loader for "Sign in with Apple JS". Structurally the mirror
// of useGoogleIdentity: load the SDK once, get back a real Apple-signed
// id_token client-side, hand it to whoever asked for it. Verification of
// that token happens server-side (see backend's AppleOAuthService) exactly
// the way Google's does — this composable's job ends at the string.
//
// One real difference from Google: Apple's popup flow still requires a
// `redirectURI` at init time, validated against a Return URL registered in
// the Apple Developer portal for this Services ID — there's no localhost
// allowance the way Google permits "Authorized JavaScript origins" for
// local dev. Defaults to the current origin, which is exactly what needs
// registering as the Return URL for wherever this is actually deployed.
let scriptPromise: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    if (document.querySelector('script[data-apple-id]')) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js'
    script.async = true
    script.defer = true
    script.dataset.appleId = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Sign in with Apple. Check your connection and try again.'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

interface AppleAuth {
  init(config: { clientId: string; scope: string; redirectURI: string; usePopup: true }): void
  signIn(): Promise<{ authorization: { id_token: string } }>
}

export function useAppleIdentity() {
  const config = useRuntimeConfig()
  const clientId = config.public.appleClientId as string

  async function signIn(): Promise<string> {
    if (!clientId) throw new Error('Sign in with Apple is not configured')
    await loadScript()
    const appleAuth = (window as any).AppleID?.auth as AppleAuth | undefined
    if (!appleAuth) throw new Error('Sign in with Apple failed to load')

    appleAuth.init({
      clientId,
      scope: 'email',
      redirectURI: window.location.origin,
      usePopup: true,
    })
    const result = await appleAuth.signIn()
    return result.authorization.id_token
  }

  return { clientId, signIn }
}
