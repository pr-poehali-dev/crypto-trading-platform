import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: number;
  email: string;
  full_name: string;
  balance_usd: number;
}

interface CryptoPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  icon: string;
}

interface Transaction {
  id: number;
  type: 'buy' | 'sell';
  symbol: string;
  amount: number;
  price_usd: number;
  total_usd: number;
  created_at: string;
}

const cryptoPrices: CryptoPrice[] = [
  { symbol: 'BTC', name: 'Bitcoin', price: 67420.50, change24h: 2.34, icon: '₿' },
  { symbol: 'ETH', name: 'Ethereum', price: 3245.80, change24h: -1.12, icon: 'Ξ' },
  { symbol: 'BNB', name: 'BNB', price: 562.30, change24h: 0.87, icon: 'B' },
  { symbol: 'SOL', name: 'Solana', price: 145.92, change24h: 5.43, icon: 'S' },
  { symbol: 'XRP', name: 'Ripple', price: 0.6234, change24h: -2.15, icon: 'X' },
  { symbol: 'ADA', name: 'Cardano', price: 0.4523, change24h: 1.98, icon: 'A' },
];

const Index = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [user, setUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoPrice | null>(null);
  const [tradeAmount, setTradeAmount] = useState('');
  const [activeTab, setActiveTab] = useState('market');
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const [prices, setPrices] = useState(cryptoPrices);

  useEffect(() => {
    const interval = setInterval(() => {
      setPrices(prev => prev.map(crypto => ({
        ...crypto,
        price: crypto.price * (1 + (Math.random() - 0.5) * 0.002),
        change24h: crypto.change24h + (Math.random() - 0.5) * 0.5
      })));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

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
        loadTransactions(data.user.id);
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

  const loadTransactions = async (userId: number) => {
    try {
      const response = await fetch(
        `https://functions.poehali.dev/76a66d2e-16fb-4539-9246-170421ed41d1?user_id=${userId}&action=history`
      );
      const data = await response.json();
      setTransactions(data);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  const handleTrade = async (type: 'buy' | 'sell') => {
    if (!selectedCrypto || !user) return;

    const amount = parseFloat(tradeAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Ошибка',
        description: 'Введите корректное количество',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch('https://functions.poehali.dev/76a66d2e-16fb-4539-9246-170421ed41d1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          action: type,
          symbol: selectedCrypto.symbol,
          amount,
          price_usd: selectedCrypto.price
        })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: type === 'buy' ? 'Покупка успешна' : 'Продажа успешна',
          description: `${amount} ${selectedCrypto.symbol} за $${(amount * selectedCrypto.price).toFixed(2)}`
        });
        setTradeAmount('');
        setSelectedCrypto(null);
        loadTransactions(user.id);
        
        const balanceResponse = await fetch(
          `https://functions.poehali.dev/76a66d2e-16fb-4539-9246-170421ed41d1?user_id=${user.id}&action=balance`
        );
        const balanceData = await balanceResponse.json();
        setUser({ ...user, balance_usd: balanceData.usd });
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
        description: 'Не удалось выполнить операцию',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-xl">
              ₿
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              CryptoEx
            </h1>
          </div>

          <nav className="hidden md:flex gap-6">
            <Button variant="ghost" onClick={() => setActiveTab('market')}>
              Рынок
            </Button>
            <Button variant="ghost" onClick={() => setActiveTab('trade')} disabled={!isLoggedIn}>
              Торговля
            </Button>
            <Button variant="ghost" onClick={() => setActiveTab('portfolio')} disabled={!isLoggedIn}>
              Портфель
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
              <Button onClick={() => { setShowAuthDialog(true); setAuthMode('login'); }}>
                <Icon name="LogIn" size={18} className="mr-2" />
                Войти
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {activeTab === 'market' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Объем 24ч</p>
                    <p className="text-2xl font-bold">$2.4B</p>
                  </div>
                  <Icon name="TrendingUp" size={32} className="text-primary" />
                </div>
              </Card>
              
              <Card className="p-6 bg-gradient-to-br from-success/10 to-success/5 border-success/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Активных трейдеров</p>
                    <p className="text-2xl font-bold">18,542</p>
                  </div>
                  <Icon name="Users" size={32} className="text-success" />
                </div>
              </Card>
              
              <Card className="p-6 bg-gradient-to-br from-chart-4/10 to-chart-4/5 border-chart-4/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Доступно монет</p>
                    <p className="text-2xl font-bold">{prices.length}</p>
                  </div>
                  <Icon name="Coins" size={32} className="text-chart-4" />
                </div>
              </Card>
            </div>

            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Icon name="BarChart3" size={24} className="text-primary" />
                Криптовалютный рынок
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4">Монета</th>
                      <th className="text-right py-3 px-4">Цена</th>
                      <th className="text-right py-3 px-4">Изменение 24ч</th>
                      <th className="text-right py-3 px-4">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prices.map((crypto, idx) => (
                      <tr
                        key={crypto.symbol}
                        className="border-b border-border/50 hover:bg-accent/50 transition-colors animate-slide-up"
                        style={{ animationDelay: `${idx * 0.1}s` }}
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold">
                              {crypto.icon}
                            </div>
                            <div>
                              <p className="font-semibold">{crypto.symbol}</p>
                              <p className="text-sm text-muted-foreground">{crypto.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-right py-4 px-4 font-mono font-semibold">
                          ${crypto.price.toFixed(2)}
                        </td>
                        <td className={`text-right py-4 px-4 font-semibold ${
                          crypto.change24h >= 0 ? 'text-success' : 'text-destructive'
                        }`}>
                          <div className="flex items-center justify-end gap-1">
                            <Icon
                              name={crypto.change24h >= 0 ? 'TrendingUp' : 'TrendingDown'}
                              size={16}
                            />
                            {crypto.change24h >= 0 ? '+' : ''}
                            {crypto.change24h.toFixed(2)}%
                          </div>
                        </td>
                        <td className="text-right py-4 px-4">
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!isLoggedIn) {
                                setShowAuthDialog(true);
                                setAuthMode('login');
                              } else {
                                setSelectedCrypto(crypto);
                                setActiveTab('trade');
                              }
                            }}
                          >
                            Торговать
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'trade' && isLoggedIn && (
          <div className="space-y-6 animate-fade-in">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Icon name="ArrowLeftRight" size={24} className="text-primary" />
                Торговая панель
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Выберите криптовалюту</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {prices.map((crypto) => (
                      <Button
                        key={crypto.symbol}
                        variant={selectedCrypto?.symbol === crypto.symbol ? 'default' : 'outline'}
                        onClick={() => setSelectedCrypto(crypto)}
                        className="justify-start"
                      >
                        <span className="text-lg mr-2">{crypto.icon}</span>
                        {crypto.symbol}
                      </Button>
                    ))}
                  </div>
                </div>

                {selectedCrypto && (
                  <div className="space-y-4">
                    <Card className="p-4 bg-primary/5 border-primary/20">
                      <p className="text-sm text-muted-foreground">Текущая цена</p>
                      <p className="text-3xl font-bold text-primary font-mono">
                        ${selectedCrypto.price.toFixed(2)}
                      </p>
                      <p className={`text-sm mt-1 ${
                        selectedCrypto.change24h >= 0 ? 'text-success' : 'text-destructive'
                      }`}>
                        {selectedCrypto.change24h >= 0 ? '+' : ''}
                        {selectedCrypto.change24h.toFixed(2)}% за 24ч
                      </p>
                    </Card>

                    <div>
                      <Label>Количество</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={tradeAmount}
                        onChange={(e) => setTradeAmount(e.target.value)}
                        className="mt-2"
                      />
                      {tradeAmount && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Итого: ${(parseFloat(tradeAmount) * selectedCrypto.price).toFixed(2)}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-success hover:bg-success/90"
                        onClick={() => handleTrade('buy')}
                      >
                        <Icon name="ArrowUp" size={18} className="mr-2" />
                        Купить
                      </Button>
                      <Button
                        className="flex-1 bg-destructive hover:bg-destructive/90"
                        onClick={() => handleTrade('sell')}
                      >
                        <Icon name="ArrowDown" size={18} className="mr-2" />
                        Продать
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'portfolio' && isLoggedIn && (
          <div className="space-y-6 animate-fade-in">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Icon name="Wallet" size={24} className="text-primary" />
                Баланс портфеля
              </h2>
              <div className="text-4xl font-bold text-primary">${user?.balance_usd.toFixed(2)}</div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Icon name="History" size={24} className="text-primary" />
                История транзакций
              </h2>
              <div className="space-y-2">
                {transactions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Транзакций пока нет</p>
                ) : (
                  transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-accent/50 hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          tx.type === 'buy' ? 'bg-success/20' : 'bg-destructive/20'
                        }`}>
                          <Icon
                            name={tx.type === 'buy' ? 'ArrowUp' : 'ArrowDown'}
                            size={20}
                            className={tx.type === 'buy' ? 'text-success' : 'text-destructive'}
                          />
                        </div>
                        <div>
                          <p className="font-semibold">
                            {tx.type === 'buy' ? 'Покупка' : 'Продажа'} {tx.symbol}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(tx.created_at).toLocaleString('ru-RU')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{tx.amount} {tx.symbol}</p>
                        <p className="text-sm text-muted-foreground">
                          ${tx.total_usd.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}
      </main>

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
              <Button className="w-full" onClick={handleAuth}>
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
              <Button className="w-full" onClick={handleAuth}>
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
