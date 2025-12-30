// get-refresh-token.js
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  '1080456035797-56e26r7h34abjborvjrjr8vpr8d3n6tp.apps.googleusercontent.com',
  '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',
  'http://localhost:3001/oauth2callback'
);

// Generar URL de autorización
const scopes = ['https://www.googleapis.com/auth/drive'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
  prompt: 'consent', // Forzar consent para obtener refresh token
});

console.log('\n✅ Autoriza la aplicación accediendo a esta URL:\n');
console.log(authUrl);
console.log('\n📋 Copiá la URL completa que aparezca después de redirigir (será algo como: http://localhost:3001/oauth2callback?code=...)');
console.log('\n💡 Luego ejecutá: node get-refresh-token.js "URL_COMPLETA"\n');

// Si se pasa la URL como argumento, obtener el refresh token
if (process.argv[2]) {
  const url = new URL(process.argv[2]);
  const code = url.searchParams.get('code');
  
  if (code) {
    oauth2Client.getToken(code, (err, token) => {
      if (err) {
        console.error('❌ Error:', err);
        return;
      }
      
      console.log('\n✅ Refresh Token obtenido!\n');
      console.log('Agregá esto a tu archivo .env:\n');
      console.log(`GOOGLE_REFRESH_TOKEN=${token.refresh_token}`);
      console.log(`\nTambién necesitás:\nGOOGLE_CLIENT_ID=1080456035797-56e26r7h34abjborvjrjr8vpr8d3n6tp.apps.googleusercontent.com`);
      console.log(`GOOGLE_CLIENT_SECRET=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`);
    });
  } else {
    console.log('❌ No se encontró el código en la URL');
  }
}

