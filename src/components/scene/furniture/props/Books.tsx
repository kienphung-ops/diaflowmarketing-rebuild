'use client'

const BOOK_DATA = [
  { width: 0.08, height: 0.22, color: '#e85d3a', tilt: 0 },
  { width: 0.07, height: 0.20, color: '#3a7de8', tilt: 0.04 },
  { width: 0.09, height: 0.24, color: '#3ab865', tilt: -0.03 },
  { width: 0.07, height: 0.19, color: '#e8b83a', tilt: 0.02 },
]

interface BooksProps {
  position?: [number, number, number]
}

export function Books({ position = [0, 0, 0] }: BooksProps) {
  let xOffset = 0
  return (
    <group position={position}>
      {BOOK_DATA.map((book, i) => {
        const x = xOffset + book.width / 2
        xOffset += book.width + 0.01
        return (
          <mesh key={i} position={[x - 0.18, book.height / 2, 0]} rotation={[0, 0, book.tilt]} castShadow>
            <boxGeometry args={[book.width, book.height, 0.12]} />
            <meshLambertMaterial color={book.color} />
          </mesh>
        )
      })}
    </group>
  )
}
