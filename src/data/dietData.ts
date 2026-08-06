export interface MealOption {
  title: string;
  items: string[];
  notes?: string;
}

export interface Meal {
  id: string;
  time: string;
  title: string;
  category: string;
  options: MealOption[];
  substitutions?: MealOption[];
}

export const DIET_INFO = {
  patient: 'Henrique Lucio da Costa',
  nutritionist: 'Karine Calixto Braga Lino',
  crn: '28995',
  contact: 'karine.calixtob@gmail.com | (35) 98873-0916',
  instagram: '@karinecalixto.nutri',
  date: '20/07/2026',
  guidelines: [
    'Bater meta de água todos os dias (~3L)',
    'Musculação 5x por semana',
    'Liberado 1 a 2 refeições livres por semana',
  ],
};

export const MEAL_PLAN: Meal[] = [
  {
    id: 'cafe_manha',
    time: '08:30',
    title: 'Café da manhã',
    category: 'Manhã',
    options: [
      {
        title: 'Opção Padrão',
        items: [
          '2 fatias de pão integral OU 1 unidade de pão de sal',
          '2 ovos OU 60g de frango desfiado',
          'Requeijão light (1 Colher de Sopa)',
          'Café (1 Xícara de Café sem açúcar)',
          '1 unidade de maçã OU pera OU 200g de melancia OU 200g de mamão',
        ],
        notes: 'Pão + recheio proteíco + café sem açúcar. Marcas recomendadas: Wickbold, Newbread ou Delícias do Trigo.',
      },
    ],
  },
  {
    id: 'lanche_manha',
    time: '11:00',
    title: 'Lanche da manhã',
    category: 'Manhã',
    options: [
      {
        title: 'Opção Padrão',
        items: [
          'Whey Protein (30g)',
          'Leite de vaca desnatado (200 ml)',
        ],
      },
    ],
  },
  {
    id: 'almoco',
    time: '13:30',
    title: 'Almoço',
    category: 'Tarde',
    options: [
      {
        title: 'Opção Padrão',
        items: [
          'Arroz (150g)',
          'Feijão (100g)',
          'Carne bovina OU Frango (130g)',
          '80g de legumes cozidos (opções variadas)',
          'Salada OU verdura crua a vontade',
        ],
        notes: 'Legumes e verduras: sempre variar as opções ao máximo e escolher, no mínimo, 3 opções de cores diferentes (até 3 colheres de sopa cada). Se forem folhas cruas, consumir à vontade.',
      },
    ],
  },
  {
    id: 'lanche_tarde',
    time: '17:30',
    title: 'Lanche da tarde',
    category: 'Tarde',
    options: [
      {
        title: 'Opção Padrão (Crepioca)',
        items: [
          'Ovo de galinha (2 unidades)',
          'Tapioca de goma (1 colher de sopa / 15g)',
          '1 fatia de mussarela OU 1 colher de sobremesa de requeijão light',
          '1 xícara de café sem açúcar',
        ],
        notes: 'Crepioca: misture os ovos com a tapioca, depois recheie com uma das opções acima.',
      },
    ],
  },
  {
    id: 'jantar',
    time: '20:30',
    title: 'Jantar',
    category: 'Noite',
    options: [
      {
        title: 'Opção Padrão',
        items: [
          'Arroz (150g)',
          'Feijão (100g)',
          'Carne bovina OU Frango (100g)',
          'Legumes cozidos (80g)',
          'Salada OU verdura crua a vontade',
        ],
      },
    ],
    substitutions: [
      {
        title: 'Substituição 1 (Cuscuz recheado)',
        items: [
          'Cuscuz de milho (150g)',
          'Frango desfiado ou carne (100g)',
          'Salada ou verdura crua (Meio prato cheio)',
        ],
        notes: 'Cuscuz recheado como alternativa prática.',
      },
    ],
  },
];
