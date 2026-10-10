# Pulse X Público

Panel experimental para comparar métricas de publicaciones públicas de X, sin pedir al usuario un token oficial.

## Ejecutar
1. Instala Node.js 18 o superior.
2. Descomprime la carpeta.
3. Abre una terminal dentro de ella y ejecuta `npm start`.
4. Abre `http://localhost:3000`.

## Límites importantes
- Esta versión intenta leer el endpoint público de sindicación de X sin autenticación.
- X puede bloquear, limitar o cambiar ese endpoint; no existe garantía de funcionamiento continuo.
- No accede a cuentas privadas, analítica privada ni a un historial completo garantizado.
- Las vistas pueden faltar y las métricas disponibles dependen de lo que entregue la fuente pública.
- No se simulan ni inventan cifras. Si la fuente no funciona, se muestra un mensaje.
- No es una web publicada en Internet: para que cualquiera pueda abrirla hace falta desplegarla en un servicio de hosting compatible con Node.js.
