/* Comptes Google (sauvegarde de la progression) et statistiques de visites.
   Vide = fonction désactivée (l'app marche normalement, sans compte).
   - GOOGLE_CLIENT_ID : identifiant client OAuth « Application Web » (console.cloud.google.com → Identifiants),
     le même que GOOGLE_CLIENT_ID dans server/wrangler.toml. Public par nature (visible dans la page).
   - ANALYTICS_TOKEN : jeton Cloudflare Web Analytics (sans cookie, sans donnée personnelle). */
export const GOOGLE_CLIENT_ID = '';
export const ANALYTICS_TOKEN = '';
