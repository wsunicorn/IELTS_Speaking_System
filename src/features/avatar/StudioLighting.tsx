/** Key + fill + rim lights so the procedural bust reads as lit, not flat. */
export function StudioLighting() {
  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight
        position={[2.2, 3, 2.5]}
        intensity={1.6}
        color="#e8ecff"
      />
      <directionalLight position={[-2.5, 1, 1.5]} intensity={0.4} color="#7fa8ff" />
      <pointLight position={[0, 1.2, -2.5]} intensity={6} color="#6ea8ff" distance={6} />
    </>
  )
}
