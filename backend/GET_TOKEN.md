# Obtener Refresh Token de Google

## Instrucciones

1. **Abrí esta URL en tu navegador**:
   ```
   https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive&prompt=consent&response_type=code&client_id=1080456035797-56e26r7h34abjborvjrjr8vpr8d3n6tp.apps.googleusercontent.com&redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Foauth2callback
   ```

2. **Autorizá la aplicación** con tu cuenta de Google

3. **Copiá la URL completa** a la que te redirige (será algo largo)

4. **Ejecutá este comando**:
   ```bash
   node get-refresh-token.js "URL_COMPLETA_AQUI"
   ```

5. **Copiá las variables** que aparezcan y agregalas a tu `.env`

## Alternativa: Usar cuenta de servicio (Más simple)

En lugar de OAuth, podés crear una cuenta de servicio:
1. Ve a Google Cloud Console
2. Crea una "Cuenta de servicio" (no OAuth)
3. Descarga el JSON
4. Guárdalo como `credentials.json`

La cuenta de servicio es más simple y recomendada para aplicaciones de servidor.

