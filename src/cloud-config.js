/* Comptes Google (sauvegarde de la progression) et statistiques de visites.
   Vide = fonction désactivée (l'app marche normalement, sans compte).
   - GOOGLE_CLIENT_ID : identifiant client OAuth « Application Web » (console.cloud.google.com → Identifiants),
     le même que GOOGLE_CLIENT_ID dans server/wrangler.toml. Public par nature (visible dans la page).
   - EMAIL_LOGIN : connexion par code à 6 chiffres envoyé par e-mail (serveur : secret RESEND_API_KEY configuré).
   - REQUIRE_LOGIN : écran de connexion obligatoire avant l'app (dès qu'une des deux méthodes est active).
   - ANALYTICS_TOKEN : jeton Cloudflare Web Analytics (sans cookie, sans donnée personnelle). */
export const GOOGLE_CLIENT_ID = '';
export const EMAIL_LOGIN = true;
export const REQUIRE_LOGIN = true;
export const ANALYTICS_TOKEN = 'd9d231508fd44df890be7d6769130993';
