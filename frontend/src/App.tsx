import { Button } from "@/components/ui/button"

function App() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Pet Hotel System — Frontend Skeleton (S1)
      </h1>
      <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
        對著 ../contracts/openapi.json 契約開發 · UI 設計由 Claude Design 交棒
      </p>
      <Button>Button</Button>
    </main>
  )
}

export default App
