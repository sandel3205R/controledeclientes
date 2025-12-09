// App version - increment this when making updates
// Format: MAJOR.MINOR.PATCH
export const APP_VERSION = '1.0.2';

// Changelog for users to see what changed
export const CHANGELOG: { version: string; date: string; changes: string[] }[] = [
  {
    version: '1.0.2',
    date: '2025-12-09',
    changes: [
      'Notificações push para alertar sobre clientes vencendo',
      'Sistema de inscrição para notificações no navegador',
      'Melhorias na estabilidade do carregamento inicial',
      'Timeout de segurança para evitar carregamento infinito',
    ],
  },
  {
    version: '1.0.1',
    date: '2024-12-09',
    changes: [
      'Exibição de data de vencimento nos cards de clientes',
      'Data de vencimento no painel lateral do vendedor',
      'Data de vencimento no banner de aviso de expiração',
      'Detecção automática de atualizações via Service Worker',
    ],
  },
  {
    version: '1.0.0',
    date: '2024-12-09',
    changes: [
      'Sistema de versionamento adicionado',
      'Notificações de atualização',
      'Suporte offline com sincronização automática',
      'Atualização automática a cada 5 segundos',
      'Sincronização de tema em tempo real',
    ],
  },
];
