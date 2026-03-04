import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Accessibility,
  Type,
  Contrast,
  MousePointerClick,
  Eye,
  RotateCcw,
  Link as LinkIcon,
  Keyboard,
} from "lucide-react";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AccessibilityPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    settings,
    setFontSize,
    setHighContrast,
    setLargeButtons,
    setSimplifiedView,
    setKeyboardNavigation,
    setHighlightLinks,
    reset,
  } = useAccessibility();

  return (
    <>
      {/* Botão flutuante de acesso rápido */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 rounded-full h-14 w-14 shadow-lg hover:scale-110 transition-transform"
        aria-label="Abrir configurações de acessibilidade"
        title="Acessibilidade (Alt+A)"
      >
        <Accessibility className="h-6 w-6" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto accessibility-panel-fixed-font">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Accessibility className="h-6 w-6" />
              Configurações de Acessibilidade
            </DialogTitle>
            <DialogDescription>
              Personalize a interface para melhorar sua experiência. As
              configurações são salvas automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {/* Tamanho da Fonte */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Type className="h-5 w-5" />
                  Tamanho da Fonte
                </CardTitle>
                <CardDescription>
                  Aumente o tamanho do texto para facilitar a leitura
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={
                      settings.fontSize === "normal" ? "default" : "outline"
                    }
                    onClick={() => setFontSize("normal")}
                    className="min-w-[100px]"
                  >
                    Normal
                  </Button>
                  <Button
                    variant={
                      settings.fontSize === "large" ? "default" : "outline"
                    }
                    onClick={() => setFontSize("large")}
                    className="min-w-[100px]"
                  >
                    Grande
                  </Button>
                  <Button
                    variant={
                      settings.fontSize === "xlarge" ? "default" : "outline"
                    }
                    onClick={() => setFontSize("xlarge")}
                    className="min-w-[100px]"
                  >
                    Extra Grande
                  </Button>
                  <Button
                    variant={
                      settings.fontSize === "xxlarge" ? "default" : "outline"
                    }
                    onClick={() => setFontSize("xxlarge")}
                    className="min-w-[100px]"
                  >
                    Muito Grande
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Alto Contraste */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Contrast className="h-5 w-5" />
                  Alto Contraste
                </CardTitle>
                <CardDescription>
                  Aumenta o contraste entre texto e fundo para melhor
                  visibilidade
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="high-contrast" className="text-base">
                    Ativar modo de alto contraste
                  </Label>
                  <Switch
                    id="high-contrast"
                    checked={settings.highContrast}
                    onCheckedChange={setHighContrast}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Botões Grandes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MousePointerClick className="h-5 w-5" />
                  Botões Grandes
                </CardTitle>
                <CardDescription>
                  Aumenta o tamanho dos botões para facilitar o clique
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="large-buttons" className="text-base">
                    Usar botões maiores
                  </Label>
                  <Switch
                    id="large-buttons"
                    checked={settings.largeButtons}
                    onCheckedChange={setLargeButtons}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Visual Simplificado */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Visual Simplificado
                </CardTitle>
                <CardDescription>
                  Remove elementos decorativos para focar no conteúdo essencial
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="simplified-view" className="text-base">
                    Ativar visual simplificado
                  </Label>
                  <Switch
                    id="simplified-view"
                    checked={settings.simplifiedView}
                    onCheckedChange={setSimplifiedView}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Links Destacados */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5" />
                  Links Destacados
                </CardTitle>
                <CardDescription>
                  Sublinha todos os links para facilitar a identificação
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="highlight-links" className="text-base">
                    Ativar destaque de links
                  </Label>
                  <Switch
                    id="highlight-links"
                    checked={settings.highlightLinks}
                    onCheckedChange={setHighlightLinks}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Navegação por Teclado */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Keyboard className="h-5 w-5" />
                  Navegação por Teclado
                </CardTitle>
                <CardDescription>
                  Permite navegar pela interface usando apenas o teclado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="keyboard-nav" className="text-base">
                    Ativar navegação por teclado (sempre ativo)
                  </Label>
                  <Switch
                    id="keyboard-nav"
                    checked={settings.keyboardNavigation}
                    disabled
                  />
                </div>
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm font-semibold mb-2">
                    Teclas de Atalho:
                  </p>
                  <ul className="text-sm space-y-1">
                    <li>
                      <kbd className="px-2 py-1 bg-background rounded border">
                        Alt
                      </kbd>{" "}
                      +{" "}
                      <kbd className="px-2 py-1 bg-background rounded border">
                        A
                      </kbd>{" "}
                      - Abrir acessibilidade
                    </li>
                    <li>
                      <kbd className="px-2 py-1 bg-background rounded border">
                        Tab
                      </kbd>{" "}
                      - Próximo elemento
                    </li>
                    <li>
                      <kbd className="px-2 py-1 bg-background rounded border">
                        Shift
                      </kbd>{" "}
                      +{" "}
                      <kbd className="px-2 py-1 bg-background rounded border">
                        Tab
                      </kbd>{" "}
                      - Elemento anterior
                    </li>
                    <li>
                      <kbd className="px-2 py-1 bg-background rounded border">
                        Enter
                      </kbd>{" "}
                      ou{" "}
                      <kbd className="px-2 py-1 bg-background rounded border">
                        Espaço
                      </kbd>{" "}
                      - Ativar botão
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Reset */}
            <Card>
              <CardContent className="pt-6">
                <Button variant="outline" onClick={reset} className="w-full">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Redefinir para Padrão
                </Button>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
