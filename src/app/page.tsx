import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Mic, Upload } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 lg:px-8">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">PazarGlobal paneli</p>
            <h1 className="text-2xl font-semibold">Chat + İlan Yönetimi</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Search className="h-4 w-4" />
              İlan Ara
            </Button>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Yeni İlan
            </Button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Hızlı İşlemler</CardTitle>
              <CardDescription>Chat, sesli giriş, dosya ve ilan akışı.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="secondary" className="w-full justify-start gap-2">
                <Mic className="h-4 w-4" /> Sesli görüşme başlat
              </Button>
              <Button variant="secondary" className="w-full justify-start gap-2">
                <Upload className="h-4 w-4" /> Dosya / görsel yükle
              </Button>
              <Separator />
              <div className="space-y-2 text-sm">
                <p className="font-medium">Kategoriler</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Otomotiv</Badge>
                  <Badge variant="secondary">Emlak</Badge>
                  <Badge variant="secondary">Elektronik</Badge>
                  <Badge variant="secondary">Kozmetik</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Chat Paneli</CardTitle>
              <CardDescription>WhatsApp kısıtları olmadan tam özellikli sohbet.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="chat" className="space-y-4">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="chat">Genel Sohbet</TabsTrigger>
                  <TabsTrigger value="listing">İlan Asistanı</TabsTrigger>
                  <TabsTrigger value="support">Destek</TabsTrigger>
                </TabsList>
                <TabsContent value="chat" className="space-y-3 text-sm text-muted-foreground">
                  <p>Streaming yanıt, sesli giriş/çıkış, dosya ekleme ve kartlı yanıtlar burada.</p>
                  <p>İlk entegrasyonda metin + dosya yükleme + ses butonu placeholder olarak gelecek.</p>
                </TabsContent>
                <TabsContent value="listing" className="space-y-3 text-sm text-muted-foreground">
                  <p>İlan oluşturma/düzenleme komutları, AI ile metin iyileştirme, kategori/etiket önerisi.</p>
                </TabsContent>
                <TabsContent value="support" className="space-y-3 text-sm text-muted-foreground">
                  <p>Canlı destek ve sık sorulan sorular için hazır akış.</p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
