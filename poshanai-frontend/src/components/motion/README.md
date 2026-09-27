# Motion components

The official `motion` runtime is installed and the upstream `InView` primitive is in `src/components/ui/in-view.jsx`. `MotionLink` is a shared interaction wrapper using `motion/react`. Existing common buttons, modal, and toast use the already-present Framer Motion package.

Motion Primitives is a copy-in component collection rather than a runtime component package. When network access is available, add a component from the official registry with the project's React/Tailwind setup, review its dependencies and JSX output, and place the resulting source here:

```jsx
import { InView } from '@/components/ui/in-view';

<InView
  once
  transition={{ duration: 0.25, ease: 'easeOut' }}
  variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
>
  <section>Content animates when it enters the viewport.</section>
</InView>
```

Add other components from the official registry with `npx.cmd shadcn@latest add "https://motion-primitives.com/c/<component>.json"`. Review generated dependencies and JSX before committing. Official docs: https://motion-primitives.com/docs. Source: https://github.com/ibelick/motion-primitives.

Prefer small, purposeful transitions (200–300 ms), preserve keyboard focus styles, and honor `prefers-reduced-motion`.
