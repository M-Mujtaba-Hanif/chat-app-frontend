// Suppress TS error for CSS side-effect imports in Next.js
declare module '*.css' {
  const content: { [className: string]: string }
  export default content
}
