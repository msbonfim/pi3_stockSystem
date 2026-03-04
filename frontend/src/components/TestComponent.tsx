export function TestComponent() {
  return (
    <div className="min-h-screen bg-white p-8">
      <h1 className="text-4xl font-bold text-black mb-4">
        Teste - Sistema de Estoque
      </h1>
      <p className="text-gray-600 mb-8">
        Se você está vendo esta mensagem, o React está funcionando!
      </p>
      <div className="bg-blue-100 p-4 rounded-lg">
        <h2 className="text-xl font-semibold text-blue-800 mb-2">
          Status do Sistema
        </h2>
        <ul className="text-blue-700 space-y-1">
          <li>✅ React funcionando</li>
          <li>✅ TypeScript funcionando</li>
          <li>✅ Vite funcionando</li>
          <li>✅ Tailwind CSS funcionando</li>
        </ul>
      </div>
    </div>
  );
}
