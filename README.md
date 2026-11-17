# GYMBROS

Juego arcade de gimnasio y transformación física: 7 minijuegos 3D, nutrición, progreso, logros y liga semanal.
Hecho con React + Vite + Three.js. Personajes y equipamiento 3D generados con Magnific.

**Jugar:** https://ivanmardones77.github.io/GYMBROS/

## Ejecutar en local

```bash
npm install --legacy-peer-deps
npm run dev
```

Abre http://localhost:3000

## Estructura

- `src/App.tsx` — pantallas principales (Gimnasio, Minijuegos, Nutrición, Progreso, Desafíos)
- `src/components/minigames/` — los 7 minijuegos 3D
- `src/components/Athlete3DViewer.tsx` — visor del atleta (clásico procedural o realista Magnific)
- `src/three/threeUtils.ts` — luces, ambientación del gimnasio, carga de modelos GLB (`MODEL_URLS`)
- `public/models/` — modelos 3D `.glb` (atletas con esqueleto y animación de reposo, equipamiento, comida)

## Publicación

Cada push a `main` se publica solo en GitHub Pages (`.github/workflows/deploy.yml`).

## Pendiente

- Animaciones de cada ejercicio para usar el atleta realista dentro de los minijuegos.
- Aplicar tono de piel, pelo y equipación al atleta realista.
- Comprimir texturas de los modelos (WebP 1024 px) para cargar más rápido.
