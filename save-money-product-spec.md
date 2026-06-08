# Save Money — Especificação Completa do Produto
> Documento de referência para desenvolvimento · Versão consolidada com V1 e V2

---

## Visão Geral

**Save Money** é um sistema web de controle de gastos pessoais com foco em experiência visual moderna, insights inteligentes e flexibilidade de lançamento. O produto deve ser desenvolvido em duas versões incrementais, conforme descrito abaixo.

---

## Design System & Identidade Visual

### Princípios Obrigatórios

- Interface **moderna, limpa e sofisticada** — sem estética genérica de IA
- Suporte nativo a **Light Mode e Dark Mode** com alternância por botão e respeito à preferência do sistema operacional (`prefers-color-scheme`)
- **100% responsivo**: deve funcionar perfeitamente em desktops (1440px), laptops (1280px), tablets (768px) e celulares (375px)
- Todas as telas devem usar **CSS Variables** para tema, permitindo troca instantânea de paleta

### Paleta de Cores

```css
/* Light Mode */
--color-bg:           #F8FAF9;
--color-surface:      #FFFFFF;
--color-border:       #E2E8E4;
--color-primary:      #1A9E6F;
--color-primary-dark: #147A55;
--color-accent:       #F0A500;
--color-text:         #1C1E1D;
--color-text-muted:   #6B7A72;
--color-danger:       #E84040;
--color-success:      #22C97A;

/* Dark Mode */
--color-bg:           #0F1512;
--color-surface:      #1A2320;
--color-border:       #2C3C35;
--color-primary:      #22C97A;
--color-primary-dark: #1A9E6F;
--color-accent:       #F0A500;
--color-text:         #ECF0EE;
--color-text-muted:   #8A9E94;
--color-danger:       #FF5A5A;
--color-success:      #22C97A;
```

### Tipografia

- Display / Títulos: **DM Serif Display** ou **Playfair Display**
- Corpo / Interface: **DM Sans** ou **Plus Jakarta Sans**
- Números / Dados: **JetBrains Mono** (valores financeiros)
- Nunca usar: Inter, Roboto, Arial, system-ui como escolha principal

### Componentes Visuais

- Cards com bordas arredondadas (12–16px) e sombra sutil
- Gráficos com animação de entrada (fade + grow)
- Botões primários com gradiente suave no tom verde
- Toasts de feedback no canto inferior direito
- Skeleton loaders em todas as chamadas assíncronas
- Transições de página suaves (200–300ms ease-in-out)
- Toggle de tema no header com ícone de sol/lua animado

### Responsividade

- Mobile: navegação inferior (bottom navigation bar) com ícones
- Tablet: sidebar colapsável em drawer lateral
- Desktop: sidebar fixa com 240px de largura
- Todos os gráficos devem ser interativos e redimensionáveis (responsive SVG)

---

## Arquitetura Recomendada

### Stack Sugerida

| Camada | Tecnologia Recomendada |
|--------|------------------------|
| Frontend | Next.js 14+ (App Router) |
| Estilo | Tailwind CSS + CSS Variables para tema |
| Gráficos | Recharts ou Chart.js |
| Autenticação | NextAuth.js ou Supabase Auth |
| Banco de Dados | PostgreSQL via Supabase ou PlanetScale |
| ORM | Prisma |
| Upload Excel | SheetJS (xlsx) |
| Export PDF | jsPDF ou Puppeteer |
| Notificações | React Hot Toast + Nodemailer |
| Deploy | Vercel |

### Banco de Dados — Esquema Resumido

```
users              → id, name, email, password_hash, currency, theme_preference
accounts           → id, user_id, name, balance, type
transactions       → id, user_id, account_id, type, amount, date, description, is_fixed, recurrence
categories         → id, user_id, name, color, icon, is_default
tags               → id, user_id, name
transaction_tags   → transaction_id, tag_id
budgets            → id, user_id, category_id, month, limit_amount
goals              → id, user_id, name, target_amount, current_amount, deadline
subscriptions      → id, user_id, name, amount, due_day, is_active
notifications      → id, user_id, type, message, read, created_at
```

---

## VERSÃO 1.0 — Core do Produto

---

### Módulo 1 — Autenticação

- Tela de login com e-mail e senha
- Opção "lembrar acesso" (remember me)
- Recuperação de senha via e-mail com link temporário
- Cadastro de novo usuário com nome, e-mail e senha
- Validação de campos em tempo real com mensagens de erro inline
- Proteção de rotas autenticadas (middleware de sessão)
- Armazenamento seguro de sessão (JWT ou cookie HTTP-only)
- Dados completamente isolados por usuário

---

### Módulo 2 — Dashboard Principal

#### Cards de Resumo (topo da tela)

- Total de entradas do mês atual
- Total de despesas do mês atual
- Saldo líquido do período
- **Card destacado: Total exclusivo de despesas fixas**

#### Gráficos

- Pizza / Donut: distribuição dos gastos por grupo/categoria
- Linha ou Barras: evolução de entradas e saídas nos últimos 6 meses
- Todos os gráficos com tooltip interativo e legenda clicável

#### Insights Automáticos

- Grupos com maior gasto no mês atual
- Meses com desvio acima da média histórica do usuário
- Sugestões objetivas de economia baseadas nos próprios dados
- Alertas quando despesas fixas ultrapassam 50% do total

#### Feed de Lançamentos Recentes

- Lista dos últimos 10 lançamentos com data, valor, grupo e hashtags
- Acesso rápido para editar ou excluir qualquer lançamento

---

### Módulo 3 — Importação via Excel

- Upload de arquivo .xlsx ou .xls
- Pré-visualização dos dados antes de confirmar
- Mapeamento de colunas (o usuário relaciona as colunas do seu arquivo com os campos do sistema)
- Colunas mínimas esperadas: data, descrição, valor, tipo (despesa/entrada)
- Alertas visuais para linhas com erro ou dados faltantes
- Importação em lote dos registros válidos
- Arquivo modelo disponível para download na tela

---

### Módulo 4 — Lançamento Manual

Campos do formulário:

- Tipo (despesa ou entrada)
- Data do lançamento
- Descrição livre
- Valor
- Conta/carteira (se houver múltiplas contas)
- Grupo/categoria (selecionável ou criação inline)
- Indicador de despesa fixa ou variável
- Hashtags (chips visuais criados ao pressionar Enter ou vírgula)
- Repetição: único, semanal, mensal (para despesas recorrentes)

Comportamento:

- Ao salvar, o lançamento aparece imediatamente no dashboard
- Lançamentos recorrentes geram instâncias automaticamente

---

### Módulo 5 — Grupos e Hashtags

#### Grupos Padrão

Alimentação · Transporte · Moradia · Saúde · Lazer · Educação · Assinaturas · Outros

#### Gestão de Grupos

- Criar novos grupos com nome, cor e ícone personalizado
- Editar nome, cor e ícone de grupos existentes
- Excluir grupos vazios (com confirmação)

#### Gestão de Hashtags

- Histórico completo de tags já usadas pelo usuário
- Autocompletar ao digitar
- Filtro por uma ou mais hashtags em qualquer listagem

---

### Módulo 6 — Comparativo Mês a Mês

- Seleção de dois ou mais meses para comparação
- Tabela comparativa por grupo com variação percentual entre períodos
- Gráfico de barras agrupadas para visualização do comparativo
- Filtro por tipo (despesas, entradas ou ambos)
- Destaque automático em grupos com crescimento acima de 10%
- Exportação da comparação em PDF ou Excel

---

### Módulo 7 — Insights e Recomendações

- Grupo com maior crescimento de gastos nos últimos 3 meses
- Comparação da média mensal de cada grupo com o mês atual
- Sugestão de metas de redução para grupos mais pesados
- Hashtag que concentra mais gastos
- Alerta quando despesas fixas ultrapassam 50% do total
- Seção dedicada de insights acessível pelo menu lateral

---

## VERSÃO 2.0 — Funcionalidades Avançadas

> Baseado em pesquisa de mercado com YNAB, Mint, Mobills, Organizze, Monarch Money, PocketGuard, Emma e Snoop.

---

### Módulo 8 — Metas Financeiras

- Criação de metas com nome, valor alvo e prazo (ex: "Reserva de emergência — R$10.000 — Dez/2025")
- Campo para vincular a meta a uma categoria ou propósito
- Cálculo automático de quanto o usuário precisa guardar por mês para atingir a meta no prazo
- Barra de progresso visual no dashboard e na tela de metas
- Opção de registrar aportes manuais para a meta
- Alerta quando o prazo está próximo e a meta ainda não foi atingida

---

### Módulo 9 — Orçamento por Grupo (Budget Limit)

- O usuário define um teto de gasto mensal por categoria (ex: R$800 em Alimentação)
- O dashboard exibe o percentual consumido de cada orçamento em tempo real
- Alerta visual quando o usuário atingir 80% e 100% do orçamento de um grupo
- Relatório mensal de orçamentos cumpridos vs. estourados
- Possibilidade de copiar os orçamentos do mês anterior como base

---

### Módulo 10 — Gerenciador de Assinaturas

- Tela dedicada para listar todas as assinaturas e despesas recorrentes
- Detecção automática de lançamentos recorrentes com mesmo valor e descrição
- Cadastro manual de assinatura com: nome, valor, dia de vencimento, status (ativa/pausada)
- Total mensal de assinaturas em card no dashboard
- Sugestão automática de assinaturas que não foram usadas no último mês
- Alerta de vencimento X dias antes da cobrança (configurável pelo usuário)

---

### Módulo 11 — Alertas e Notificações

Tipos de notificação disponíveis:

- Orçamento de categoria próximo do limite (80% e 100%)
- Vencimento de assinatura ou conta recorrente
- Meta financeira com prazo se aproximando
- Desvio de gasto acima do padrão histórico detectado
- Resumo semanal de gastos (opcional)
- Fechamento de mês com balanço geral

Canais de entrega:

- Notificações in-app (sino no header com badge de contagem)
- E-mail (configurável por tipo de alerta)
- Push notification (PWA)

---

### Módulo 12 — Indicador de Pace (Ritmo de Gasto)

- Card no dashboard mostrando o ritmo atual de gastos vs. o esperado para o mês
- Cálculo: (gasto até hoje / dias passados) vs. (orçamento total / dias do mês)
- Status visual: No Ritmo · Acelerado · Crítico
- Projeção automática de quanto o usuário irá gastar até o fim do mês se mantiver o ritmo atual
- Destaque visual quando a projeção ultrapassar a renda do mês

---

### Módulo 13 — Carteira Compartilhada

- O usuário pode convidar outro usuário por e-mail para compartilhar uma carteira
- Permissões configuráveis: apenas visualizar ou também lançar
- Histórico de quem fez cada lançamento (auditoria)
- Dashboard unificado mostrando os gastos de todos os membros da carteira
- Indicado para casais, famílias ou repúblicas

---

### Módulo 14 — Patrimônio Líquido (Net Worth)

- Tela de cadastro de ativos (conta corrente, poupança, investimentos, imóveis, veículos)
- Tela de cadastro de passivos (dívidas, financiamentos, cartão de crédito)
- Cálculo automático: Patrimônio Líquido = Ativos − Passivos
- Gráfico de evolução do patrimônio ao longo do tempo
- Atualização manual dos valores com histórico de alterações

---

### Módulo 15 — Assistente de IA Financeiro

- Chat integrado acessível pelo botão fixo no canto inferior da tela
- O assistente tem acesso aos dados financeiros do usuário (com consentimento)
- Capacidades:
  - Responder perguntas como "Quanto gastei com alimentação esse mês?"
  - Gerar resumos: "Me dê um relatório do mês de março"
  - Sugerir cortes: "Onde posso economizar este mês?"
  - Analisar tendências: "Meus gastos com lazer aumentaram?"
- Histórico de conversas salvo por sessão

---

### Módulo 16 — Suporte a Múltiplas Moedas

- Configuração de moeda principal do usuário (padrão: BRL)
- Lançamentos podem ser registrados em outra moeda com conversão automática
- Taxa de câmbio atualizada via API (ex: AwesomeAPI ou Open Exchange Rates)
- Relatórios sempre exibem o total convertido para a moeda principal
- Histórico de taxas utilizadas para cada lançamento

---

### Módulo 17 — Relatório para Imposto de Renda

- Exportação anual de todas as transações em formato estruturado (PDF e Excel)
- Agrupamento por categoria com totais anuais
- Filtro por tipo de gasto (dedutível / não dedutível — configurável pelo usuário)
- Formatação clara e pronta para consulta no momento da declaração

---

## Padrões Gerais de Desenvolvimento

### Performance

- Skeleton loaders em todas as chamadas assíncronas
- Paginação ou scroll infinito em listagens longas
- Lazy loading de componentes pesados (gráficos, modais)
- Cache de dados do dashboard por 5 minutos

### Acessibilidade

- Contraste mínimo AA (WCAG 2.1) em ambos os temas
- Navegação completa por teclado
- Atributos ARIA em componentes interativos
- Textos alternativos em todos os ícones funcionais

### Segurança

- Senhas armazenadas com bcrypt (mínimo 12 rounds)
- Tokens JWT com expiração e refresh token
- Rate limiting em endpoints de autenticação
- Validação de dados no servidor (nunca só no cliente)
- HTTPS obrigatório em produção

### UX

- Confirmação antes de qualquer exclusão de dado
- Toast de feedback em toda ação do usuário
- Estado vazio (empty state) em todas as telas sem dados
- Onboarding guiado para novos usuários (3 passos)

---

## Roadmap de Entregas

| Fase | Conteúdo | Prazo Sugerido |
|------|----------|----------------|
| MVP (V1 Alpha) | Autenticação + Lançamento Manual + Dashboard básico | 4–6 semanas |
| V1 Beta | Importação Excel + Grupos + Hashtags | +3 semanas |
| V1.0 Release | Comparativo Mês a Mês + Insights + Exportação | +2 semanas |
| V2 Alpha | Metas + Orçamento + Assinaturas + Alertas | +4 semanas |
| V2 Beta | Pace + Carteira Compartilhada + Net Worth | +3 semanas |
| V2.0 Release | Assistente IA + Multi-moeda + Relatório IR | +4 semanas |

---

## Entregáveis Esperados por Versão

### V1.0
- Código-fonte completo e organizado
- Instruções de instalação e configuração do ambiente
- Esquema do banco de dados com comentários
- Arquivo Excel modelo para importação
- Documentação resumida das rotas e funcionalidades

### V2.0
- Tudo do V1.0 mais:
- Documentação da API do assistente de IA
- Guia de configuração de notificações e e-mail
- Documentação de integração com APIs de câmbio
- Testes automatizados (unit + integration) com cobertura mínima de 70%

---

*Documento gerado para o projeto Save Money · Atualizado com pesquisa de mercado comparativa*
