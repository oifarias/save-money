// Dados mockados para validar a jornada de UX/UI da nova tela de Desejos antes de implementar o backend.
// Nada aqui toca o banco real — é consumido só por /desejos-preview.

export type MockSubcategory = { id: string; name: string; color: string; icon: string };

export type MockCategory = {
  id: string;
  name: string;
  color: string;
  icon: string;
  children: MockSubcategory[];
  budget: { limitAmount: number; spent: number } | null;
};

export type MockWishStatus = "ACTIVE" | "PURCHASED" | "ABANDONED";

export type MockPurchaseTiming = "this_month" | "next_month" | "later";

export type MockPaymentMethod = "cash" | "installments";

export type MockWishKind = "need" | "want";

export type MockWish = {
  id: string;
  name: string;
  estimatedAmount: number;
  link: string | null;
  categoryId: string;
  subcategoryId: string;
  status: MockWishStatus;
  priority: number;
  notes: string | null;
  goal: { currentAmount: number; targetAmount: number } | null;
  cashTimelineLabel: string | null;
  purchaseTiming: MockPurchaseTiming;
  paymentMethod: MockPaymentMethod;
  installmentsCount: number | null;
  installmentAmount: number | null;
  kind: MockWishKind;
};

export const PURCHASE_TIMING_LABELS: Record<MockPurchaseTiming, string> = {
  this_month: "Este mês",
  next_month: "Mês que vem",
  later: "Mais pra frente (sem data)",
};

export const WISH_KIND_LABELS: Record<MockWishKind, string> = {
  need: "Necessidade",
  want: "Desejo",
};

export const MOCK_CATEGORIES: MockCategory[] = [
  {
    id: "cat-lazer",
    name: "Lazer",
    color: "#F59E0B",
    icon: "Popcorn",
    budget: { limitAmount: 600, spent: 180 },
    children: [
      { id: "sub-hobbies", name: "Hobbies", color: "#F59E0B", icon: "Popcorn" },
      { id: "sub-streaming", name: "Streaming", color: "#F59E0B", icon: "Popcorn" },
    ],
  },
  {
    id: "cat-educacao",
    name: "Educação",
    color: "#3B82F6",
    icon: "GraduationCap",
    budget: { limitAmount: 500, spent: 420 },
    children: [{ id: "sub-cursos", name: "Cursos", color: "#3B82F6", icon: "GraduationCap" }],
  },
  {
    id: "cat-casa",
    name: "Casa",
    color: "#10B981",
    icon: "Home",
    budget: { limitAmount: 900, spent: 250 },
    children: [{ id: "sub-eletro", name: "Eletrodomésticos", color: "#10B981", icon: "Home" }],
  },
  {
    id: "cat-tecnologia",
    name: "Tecnologia",
    color: "#8B5CF6",
    icon: "Smartphone",
    budget: null,
    children: [{ id: "sub-gadgets", name: "Gadgets", color: "#8B5CF6", icon: "Smartphone" }],
  },
];

export const MOCK_WISHES: MockWish[] = [
  {
    id: "wish-1",
    name: "Fone de ouvido bluetooth",
    estimatedAmount: 150,
    link: "https://www.exemplo.com/fone-bluetooth",
    categoryId: "cat-lazer",
    subcategoryId: "sub-hobbies",
    status: "ACTIVE",
    priority: 1,
    notes: null,
    goal: null,
    cashTimelineLabel: "Pode comprar à vista este mês",
    purchaseTiming: "this_month",
    paymentMethod: "cash",
    installmentsCount: null,
    installmentAmount: null,
    kind: "want",
  },
  {
    id: "wish-2",
    name: "Notebook novo",
    estimatedAmount: 4500,
    link: "https://www.exemplo.com/notebook-novo",
    categoryId: "cat-educacao",
    subcategoryId: "sub-cursos",
    status: "ACTIVE",
    priority: 2,
    notes: "Pra fazer o curso de design",
    goal: { currentAmount: 900, targetAmount: 4500 },
    cashTimelineLabel: null,
    purchaseTiming: "later",
    paymentMethod: "installments",
    installmentsCount: 12,
    installmentAmount: 375,
    kind: "need",
  },
  {
    id: "wish-3",
    name: "Air fryer",
    estimatedAmount: 380,
    link: null,
    categoryId: "cat-casa",
    subcategoryId: "sub-eletro",
    status: "ACTIVE",
    priority: 3,
    notes: null,
    goal: { currentAmount: 380, targetAmount: 380 },
    cashTimelineLabel: "Pode comprar à vista este mês",
    purchaseTiming: "this_month",
    paymentMethod: "cash",
    installmentsCount: null,
    installmentAmount: null,
    kind: "need",
  },
  {
    id: "wish-4",
    name: "Smartwatch",
    estimatedAmount: 1200,
    link: "https://www.exemplo.com/smartwatch",
    categoryId: "cat-tecnologia",
    subcategoryId: "sub-gadgets",
    status: "ACTIVE",
    priority: 4,
    notes: null,
    goal: null,
    cashTimelineLabel: null,
    purchaseTiming: "next_month",
    paymentMethod: "installments",
    installmentsCount: 6,
    installmentAmount: 200,
    kind: "want",
  },
  {
    id: "wish-5",
    name: "Curso de inglês",
    estimatedAmount: 800,
    link: null,
    categoryId: "cat-educacao",
    subcategoryId: "sub-cursos",
    status: "ACTIVE",
    priority: 5,
    notes: null,
    goal: { currentAmount: 200, targetAmount: 800 },
    cashTimelineLabel: "Pode comprar à vista em jan/27",
    purchaseTiming: "later",
    paymentMethod: "cash",
    installmentsCount: null,
    installmentAmount: null,
    kind: "need",
  },
  {
    id: "wish-6",
    name: "Assinatura streaming anual",
    estimatedAmount: 240,
    link: "https://www.exemplo.com/streaming-anual",
    categoryId: "cat-lazer",
    subcategoryId: "sub-streaming",
    status: "ACTIVE",
    priority: 6,
    notes: null,
    goal: null,
    cashTimelineLabel: "Pode comprar à vista este mês",
    purchaseTiming: "this_month",
    paymentMethod: "cash",
    installmentsCount: null,
    installmentAmount: null,
    kind: "want",
  },
  {
    id: "wish-7",
    name: "Liquidificador",
    estimatedAmount: 220,
    link: null,
    categoryId: "cat-casa",
    subcategoryId: "sub-eletro",
    status: "PURCHASED",
    priority: 0,
    notes: null,
    goal: null,
    cashTimelineLabel: null,
    purchaseTiming: "this_month",
    paymentMethod: "cash",
    installmentsCount: null,
    installmentAmount: null,
    kind: "need",
  },
  {
    id: "wish-8",
    name: "Console de videogame",
    estimatedAmount: 3000,
    link: null,
    categoryId: "cat-tecnologia",
    subcategoryId: "sub-gadgets",
    status: "ABANDONED",
    priority: 0,
    notes: null,
    goal: null,
    cashTimelineLabel: null,
    purchaseTiming: "later",
    paymentMethod: "cash",
    installmentsCount: null,
    installmentAmount: null,
    kind: "want",
  },
];
