import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: number;
  email: string;
  full_name: string;
  balance_usd: number;
}

interface ProxyPlan {
  id: number;
  name: string;
  type: string;
  description: string;
  price_per_month: number;
  max_connections: number;
  speed: string;
  locations: string[];
}

interface ProxyOrder {
  id: number;
  plan_name: string;
  plan_type: string;
  location: string;
  quantity: number;
  duration_months: number;
  total_price: number;
  status: string;
  expires_at: string;
  created_at: string;
  proxies: {
    host: string;
    port: number;
    username: string;
    password: string;
    location: string;
    status: string;
  }[];
}

const Index = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [user, setUser] = useState<User | null>(null);
  const [plans, setPlans] = useState<ProxyPlan[]>([]);
  const [orders, setOrders] = useState<ProxyOrder[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ProxyPlan | null>(null);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [duration, setDuration] = useState(1);
  const [activeTab, setActiveTab] = useState('plans');
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const response = await fetch(
        'https://functions.poehali.dev/942358f4-933a-4af3-93eb-e5e26ca2fee8?action=plans'
      );
      const data = await response.json();
      setPlans(data);
    } catch (error) {
      console.error('Failed to load plans:', error);
    }
  };

  const loadOrders = async (userId: number) => {
    try {
      const response = await fetch(
        `https://functions.poehali.dev/942358f4-933a-4af3-93eb-e5e26ca2fee8?action=orders&user_id=${userId}`
      );
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  };

  const handleAuth = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/512b9ee2-9d11-4fb8-9889-4772bca0fb7d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: authMode,
          email,
          password,
          ...(authMode === 'register' && { full_name: fullName })
        })
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        setIsLoggedIn(true);
        setShowAuthDialog(false);
        toast({
          title: authMode === 'login' ? 'Вход выполнен' : 'Регистрация успешна',
          description: `Добро пожаловать, ${data.user.full_name}!`
        });
        loadOrders(data.user.id);
      } else {
        toast({
          title: 'Ошибка',
          description: data.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось подключиться к серверу',
        variant: 'destructive'
      });
    }
  };

  const handlePurchase = async () => {
    if (!selectedPlan || !selectedLocation || !user) return;

    try {
      const response = await fetch('https://functions.poehali.dev/942358f4-933a-4af3-93eb-e5e26ca2fee8', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          plan_id: selectedPlan.id,
          location: selectedLocation,
          quantity,
          duration_months: duration
        })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Покупка успешна!',
          description: `Вы приобрели ${quantity} прокси на ${duration} мес.`
        });
        setSelectedPlan(null);
        setSelectedLocation('');
        setQuantity(1);
        setDuration(1);
        loadOrders(user.id);
        
        const userResponse = await fetch(
          `https://functions.poehali.dev/76a66d2e-16fb-4539-9246-170421ed41d1?user_id=${user.id}&action=balance`
        );
        const balanceData = await userResponse.json();
        setUser({ ...user, balance_usd: balanceData.usd });
        
        setActiveTab('orders');
      } else {
        toast({
          title: 'Ошибка',
          description: data.error,
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось выполнить покупку',
        variant: 'destructive'
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Скопировано!',
      description: 'Данные скопированы в буфер обмена'
    });
  };

  const getPlanIcon = (type: string) => {
    switch (type) {
      case 'public': return 'Users';
      case 'private': return 'Shield';
      case 'dedicated': return 'Zap';
      default: return 'Server';
    }
  };

  const getPlanColor = (type: string) => {
    switch (type) {
      case 'public': return 'from-chart-4/20 to-chart-4/5 border-chart-4/30';
      case 'private': return 'from-primary/20 to-primary/5 border-primary/30';
      case 'dedicated': return 'from-chart-2/20 to-chart-2/5 border-chart-2/30';
      default: return 'from-muted/20 to-muted/5 border-muted/30';
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center text-black font-bold text-xl shadow-lg shadow-primary/20">
              ⚡
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                ProxyMC
              </h1>
              <p className="text-xs text-muted-foreground">Прокси для Minecraft</p>
            </div>
          </div>

          <nav className="hidden md:flex gap-6">
            <Button variant="ghost" onClick={() => setActiveTab('plans')}>
              Тарифы
            </Button>
            <Button variant="ghost" onClick={() => setActiveTab('orders')} disabled={!isLoggedIn}>
              Мои прокси
            </Button>
          </nav>

          <div className="flex items-center gap-2">
            {isLoggedIn && user ? (
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-sm text-muted-foreground">{user.full_name}</p>
                  <p className="text-lg font-bold text-primary">${user.balance_usd.toFixed(2)}</p>
                </div>
                <Button variant="outline" onClick={() => setIsLoggedIn(false)}>
                  <Icon name="LogOut" size={18} />
                </Button>
              </div>
            ) : (
              <Button className="bg-primary hover:bg-primary/90 text-black font-semibold" onClick={() => { setShowAuthDialog(true); setAuthMode('login'); }}>
                <Icon name="LogIn" size={18} className="mr-2" />
                Войти
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {activeTab === 'plans' && (
          <div className="space-y-8 animate-fade-in">
            <div className="text-center space-y-4 py-8">
              <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
                Премиум прокси для Minecraft
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Обходите баны и играйте без ограничений. Высокая скорость, стабильность и надежность.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan, idx) => (
                <Card
                  key={plan.id}
                  className={`p-6 bg-gradient-to-br ${getPlanColor(plan.type)} hover:scale-105 transition-all duration-300 cursor-pointer animate-slide-up`}
                  style={{ animationDelay: `${idx * 0.1}s` }}
                  onClick={() => {
                    if (!isLoggedIn) {
                      setShowAuthDialog(true);
                      setAuthMode('login');
                    } else {
                      setSelectedPlan(plan);
                      setSelectedLocation(plan.locations[0]);
                    }
                  }}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Icon name={getPlanIcon(plan.type)} size={24} className="text-primary" />
                      </div>
                      <Badge variant="outline" className="border-primary text-primary">
                        {plan.type}
                      </Badge>
                    </div>

                    <div>
                      <h3 className="text-2xl font-bold">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                    </div>

                    <div className="py-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-primary">${plan.price_per_month}</span>
                        <span className="text-muted-foreground">/месяц</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Icon name="Zap" size={16} className="text-primary" />
                        <span>Скорость: {plan.speed}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Icon name="Link" size={16} className="text-primary" />
                        <span>До {plan.max_connections} подключений</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Icon name="Globe" size={16} className="text-primary" />
                        <span>{plan.locations.length} локаций</span>
                      </div>
                    </div>

                    <Button className="w-full bg-primary hover:bg-primary/90 text-black font-semibold">
                      Выбрать тариф
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="p-8 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                    <Icon name="Shield" size={32} className="text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">Безопасность</h3>
                  <p className="text-muted-foreground">Полная анонимность и защита данных</p>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                    <Icon name="Gauge" size={32} className="text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">Скорость</h3>
                  <p className="text-muted-foreground">До 1 Gbps для игры без лагов</p>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
                    <Icon name="Clock" size={32} className="text-primary" />
                  </div>
                  <h3 className="text-xl font-bold">24/7 Работа</h3>
                  <p className="text-muted-foreground">Стабильная работа круглосуточно</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'orders' && isLoggedIn && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold">Мои прокси</h2>
              <Button variant="outline" onClick={() => setActiveTab('plans')}>
                <Icon name="Plus" size={18} className="mr-2" />
                Купить еще
              </Button>
            </div>

            {orders.length === 0 ? (
              <Card className="p-12 text-center">
                <Icon name="Package" size={48} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">У вас пока нет прокси</h3>
                <p className="text-muted-foreground mb-4">Выберите тариф и начните играть без ограничений</p>
                <Button onClick={() => setActiveTab('plans')}>
                  Выбрать тариф
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id} className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold">{order.plan_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {order.location} • {order.quantity} прокси • {order.duration_months} мес.
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-primary/20 text-primary border-primary">
                            {order.status}
                          </Badge>
                          <p className="text-sm text-muted-foreground mt-1">
                            До {new Date(order.expires_at).toLocaleDateString('ru-RU')}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {order.proxies.map((proxy, idx) => (
                          <div
                            key={idx}
                            className="p-4 rounded-lg bg-muted/30 space-y-2"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs text-muted-foreground">Хост</Label>
                                <div className="flex items-center gap-2">
                                  <code className="text-sm font-mono">{proxy.host}:{proxy.port}</code>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => copyToClipboard(`${proxy.host}:${proxy.port}`)}
                                  >
                                    <Icon name="Copy" size={14} />
                                  </Button>
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Авторизация</Label>
                                <div className="flex items-center gap-2">
                                  <code className="text-sm font-mono">{proxy.username}:{proxy.password}</code>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => copyToClipboard(`${proxy.username}:${proxy.password}`)}
                                  >
                                    <Icon name="Copy" size={14} />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <Dialog open={!!selectedPlan} onOpenChange={() => setSelectedPlan(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Покупка прокси: {selectedPlan?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Локация</Label>
              <select
                className="w-full mt-2 p-2 rounded-md bg-muted border border-border"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
              >
                {selectedPlan?.locations.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            <div>
              <Label>Количество прокси</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value))}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Срок (месяцев)</Label>
              <Input
                type="number"
                min="1"
                max="12"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="mt-2"
              />
            </div>

            <Card className="p-4 bg-primary/5 border-primary/30">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Итого:</span>
                <span className="text-2xl font-bold text-primary">
                  ${selectedPlan ? (selectedPlan.price_per_month * quantity * duration).toFixed(2) : '0.00'}
                </span>
              </div>
            </Card>

            <Button className="w-full bg-primary hover:bg-primary/90 text-black font-semibold" onClick={handlePurchase}>
              <Icon name="ShoppingCart" size={18} className="mr-2" />
              Купить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {authMode === 'login' ? 'Вход в аккаунт' : 'Регистрация'}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={authMode} onValueChange={(v) => setAuthMode(v as 'login' | 'register')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Вход</TabsTrigger>
              <TabsTrigger value="register">Регистрация</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label>Пароль</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button className="w-full bg-primary hover:bg-primary/90 text-black font-semibold" onClick={handleAuth}>
                Войти
              </Button>
            </TabsContent>

            <TabsContent value="register" className="space-y-4">
              <div>
                <Label>Имя</Label>
                <Input
                  placeholder="Иван Иванов"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label>Пароль</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button className="w-full bg-primary hover:bg-primary/90 text-black font-semibold" onClick={handleAuth}>
                Зарегистрироваться
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
