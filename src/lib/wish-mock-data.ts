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

export type MockWish = {
  id: string;
  name: string;
  estimatedAmount: number;
  categoryId: string;
  subcategoryId: string;
  status: MockWishStatus;
  priority: number;
  notes: string | null;
  goal: { currentAmount: number; targetAmount: number } | null;
  cashTimelineLabel: string | null;
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
    categoryId: "cat-lazer",
    subcategoryId: "sub-hobbies",
    status: "ACTIVE",
    priority: 1,
    notes: null,
    goal: null,
    cashTimelineLabel: "Pode comprar à vista este mês",
  },
  {
    id: "wish-2",
    name: "Notebook novo",
    estimatedAmount: 4500,
    categoryId: "cat-educacao",
    subcategoryId: "sub-cursos",
    status: "ACTIVE",
    priority: 2,
    notes: "Pra fazer o curso de design",
    goal: { currentAmount: 900, targetAmount: 4500 },
    cashTimelineLabel: null,
  },
  {
    id: "wish-3",
    name: "Air fryer",
    estimatedAmount: 380,
    categoryId: "cat-casa",
    subcategoryId: "sub-eletro",
    status: "ACTIVE",
    priority: 3,
    notes: null,
    goal: { currentAmount: 380, targetAmount: 380 },
    cashTimelineLabel: "Pode comprar à vista este mês",
  },
  {
    id: "wish-4",
    name: "Smartwatch",
    estimatedAmount: 1200,
    categoryId: "cat-tecnologia",
    subcategoryId: "sub-gadgets",
    status: "ACTIVE",
    priority: 4,
    notes: null,
    goal: null,
    cashTimelineLabel: null,
  },
  {
    id: "wish-5",
    name: "Curso de inglês",
    estimatedAmount: 800,
    categoryId: "cat-educacao",
    subcategoryId: "sub-cursos",
    status: "ACTIVE",
    priority: 5,
    notes: null,
    goal: { currentAmount: 200, targetAmount: 800 },
    cashTimelineLabel: "Pode comprar à vista em jan/27",
  },
  {
    id: "wish-6",
    name: "Assinatura streaming anual",
    estimatedAmount: 240,
    categoryId: "cat-lazer",
    subcategoryId: "sub-streaming",
    status: "ACTIVE",
    priority: 6,
    notes: null,
    goal: null,
    cashTimelineLabel: "Pode comprar à vista este mês",
  },
  {
    id: "wish-7",
    name: "Liquidificador",
    estimatedAmount: 220,
    categoryId: "cat-casa",
    subcategoryId: "sub-eletro",
    status: "PURCHASED",
    priority: 0,
    notes: null,
    goal: null,
    cashTimelineLabel: null,
  },
  {
    id: "wish-8",
    name: "Console de videogame",
    estimatedAmount: 3000,
    categoryId: "cat-tecnologia",
    subcategoryId: "sub-gadgets",
    status: "ABANDONED",
    priority: 0,
    notes: null,
    goal: null,
    cashTimelineLabel: null,
  },
];
