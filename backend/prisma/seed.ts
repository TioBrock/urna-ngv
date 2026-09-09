import { PrismaClient, ElectionStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const STATES = [
  { name: 'Acre', abbreviation: 'AC' },
  { name: 'Alagoas', abbreviation: 'AL' },
  { name: 'Amapá', abbreviation: 'AP' },
  { name: 'Amazonas', abbreviation: 'AM' },
  { name: 'Bahia', abbreviation: 'BA' },
  { name: 'Ceará', abbreviation: 'CE' },
  { name: 'Distrito Federal', abbreviation: 'DF' },
  { name: 'Espírito Santo', abbreviation: 'ES' },
  { name: 'Goiás', abbreviation: 'GO' },
  { name: 'Maranhão', abbreviation: 'MA' },
  { name: 'Mato Grosso', abbreviation: 'MT' },
  { name: 'Mato Grosso do Sul', abbreviation: 'MS' },
  { name: 'Minas Gerais', abbreviation: 'MG' },
  { name: 'Pará', abbreviation: 'PA' },
  { name: 'Paraíba', abbreviation: 'PB' },
  { name: 'Paraná', abbreviation: 'PR' },
  { name: 'Pernambuco', abbreviation: 'PE' },
  { name: 'Piauí', abbreviation: 'PI' },
  { name: 'Rio de Janeiro', abbreviation: 'RJ' },
  { name: 'Rio Grande do Norte', abbreviation: 'RN' },
  { name: 'Rio Grande do Sul', abbreviation: 'RS' },
  { name: 'Rondônia', abbreviation: 'RO' },
  { name: 'Roraima', abbreviation: 'RR' },
  { name: 'Santa Catarina', abbreviation: 'SC' },
  { name: 'São Paulo', abbreviation: 'SP' },
  { name: 'Sergipe', abbreviation: 'SE' },
  { name: 'Tocantins', abbreviation: 'TO' },
];

const POSITIONS = [
  {
    name: 'Presidente',
    description: 'Presidente da República — Chefe do Poder Executivo da União (2 dígitos)',
    scope: 'NACIONAL',
    isNational: true,
    defaultDigitCount: 2,
    defaultSlots: 1,
  },
  {
    name: 'Vice-Presidente',
    description: 'Vice-Presidente da República — Chapa conjunta com Presidente (2 dígitos)',
    scope: 'NACIONAL',
    isNational: true,
    defaultDigitCount: 2,
    defaultSlots: 1,
  },
  {
    name: 'Governador',
    description: 'Governador do Estado — Chefe do Poder Executivo Estadual (2 dígitos)',
    scope: 'ESTADUAL',
    isNational: false,
    defaultDigitCount: 2,
    defaultSlots: 1,
  },
  {
    name: 'Vice-Governador',
    description: 'Vice-Governador do Estado — Chapa conjunta com Governador (2 dígitos)',
    scope: 'ESTADUAL',
    isNational: false,
    defaultDigitCount: 2,
    defaultSlots: 1,
  },
  {
    name: 'Senador',
    description: 'Senador — Representante do Estado no Congresso Nacional (3 dígitos)',
    scope: 'ESTADUAL',
    isNational: false,
    defaultDigitCount: 3,
    defaultSlots: 1,
  },
  {
    name: 'Deputado Federal',
    description: 'Deputado Federal — Câmara dos Deputados eleito pelo Estado (4 dígitos)',
    scope: 'ESTADUAL',
    isNational: false,
    defaultDigitCount: 4,
    defaultSlots: 1,
  },
  {
    name: 'Deputado Estadual',
    description: 'Deputado Estadual — Assembleia Legislativa do Estado (5 dígitos)',
    scope: 'ESTADUAL',
    isNational: false,
    defaultDigitCount: 5,
    defaultSlots: 1,
  },
  {
    name: 'Prefeito',
    description: 'Prefeito Municipal — Chefe do Poder Executivo Municipal (2 dígitos)',
    scope: 'MUNICIPAL',
    isNational: false,
    defaultDigitCount: 2,
    defaultSlots: 1,
  },
  {
    name: 'Vereador',
    description: 'Vereador — Câmara Municipal do Município (5 dígitos)',
    scope: 'MUNICIPAL',
    isNational: false,
    defaultDigitCount: 5,
    defaultSlots: 1,
  },
];

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // ── Admin inicial ──
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@urna.ngv';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';
  const adminName = process.env.ADMIN_NAME ?? 'Administrador';

  const existingAdmin = await prisma.adminUser.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    await prisma.adminUser.create({
      data: { email: adminEmail, name: adminName, password: hashedPassword },
    });
    console.log(`✅ Admin criado: ${adminEmail} (senha: ${adminPassword})`);
  } else {
    console.log(`ℹ️  Admin já existe: ${adminEmail}`);
  }

  // ── Estados ──
  for (const state of STATES) {
    await prisma.state.upsert({
      where: { abbreviation: state.abbreviation },
      update: { name: state.name },
      create: state,
    });
  }
  console.log(`✅ ${STATES.length} estados carregados`);

  // ── Cargos base ──
  for (const position of POSITIONS) {
    await prisma.position.upsert({
      where: { name: position.name },
      update: {
        description: position.description,
        scope: position.scope,
        isNational: position.isNational,
        defaultDigitCount: position.defaultDigitCount,
        defaultSlots: position.defaultSlots,
      },
      create: position,
    });
  }
  console.log(`✅ ${POSITIONS.length} cargos base carregados`);

  // ── Eleição de exemplo ──
  const existingElection = await prisma.election.findFirst({
    where: { name: 'Eleições Gerais 1994' },
  });

  if (!existingElection) {
    const election = await prisma.election.create({
      data: {
        name: 'Eleições Gerais 1994',
        description: 'Eleições gerais do Brasil — 1994. Eleição de Presidente, Senadores, Governadores e Deputados Federais.',
        year: 1994,
        status: ElectionStatus.DRAFT,
      },
    });

    // Associar todos os estados
    const allStates = await prisma.state.findMany();
    await prisma.electionState.createMany({
      data: allStates.map((s) => ({ electionId: election.id, stateId: s.id })),
    });

    // Configurar cargos na ordem
    const depFederal = await prisma.position.findFirst({ where: { name: 'Deputado Federal' } });
    const senador = await prisma.position.findFirst({ where: { name: 'Senador' } });
    const governador = await prisma.position.findFirst({ where: { name: 'Governador' } });
    const presidente = await prisma.position.findFirst({ where: { name: 'Presidente' } });

    if (depFederal && senador && governador && presidente) {
      await prisma.electionPosition.createMany({
        data: [
          {
            electionId: election.id,
            positionId: depFederal.id,
            order: 1,
            slots: 1,
            digitCount: 4,
            isNational: false,
          },
          {
            electionId: election.id,
            positionId: senador.id,
            order: 2,
            slots: 2,
            digitCount: 3,
            isNational: false,
          },
          {
            electionId: election.id,
            positionId: governador.id,
            order: 3,
            slots: 1,
            digitCount: 2,
            isNational: false,
          },
          {
            electionId: election.id,
            positionId: presidente.id,
            order: 4,
            slots: 1,
            digitCount: 2,
            isNational: true,
          },
        ],
      });
    }

    console.log(`✅ Eleição de exemplo criada: Eleições Gerais 1994`);
  } else {
    console.log(`ℹ️  Eleição de exemplo já existe`);
  }

  // Garante que a eleição esteja ABERTA e com candidatos de teste
  const election = await prisma.election.findFirst({
    where: { name: 'Eleições Gerais 1994' },
  });

  if (election) {
    await prisma.election.update({
      where: { id: election.id },
      data: { status: ElectionStatus.OPEN },
    });

    const presidente = await prisma.position.findFirst({ where: { name: 'Presidente' } });
    const governador = await prisma.position.findFirst({ where: { name: 'Governador' } });
    const senador = await prisma.position.findFirst({ where: { name: 'Senador' } });
    const depFederal = await prisma.position.findFirst({ where: { name: 'Deputado Federal' } });

    const sampleCandidates = [
      // Presidente (2 dígitos, Nacional)
      {
        electionId: election.id,
        positionId: presidente!.id,
        number: '13',
        electoralName: 'LULA',
        name: 'Luiz Inácio Lula da Silva',
        party: 'PT',
        viceCandidateName: 'Aloizio Mercadante',
        isNational: true,
      },
      {
        electionId: election.id,
        positionId: presidente!.id,
        number: '45',
        electoralName: 'FERNANDO HENRIQUE CARDOSO',
        name: 'Fernando Henrique Cardoso (FHC)',
        party: 'PSDB',
        viceCandidateName: 'Marco Maciel',
        isNational: true,
      },
      {
        electionId: election.id,
        positionId: presidente!.id,
        number: '56',
        electoralName: 'ENÉAS',
        name: 'Enéas Ferreira Carneiro',
        party: 'PRONA',
        viceCandidateName: 'Roberto Monteiro',
        isNational: true,
      },
      {
        electionId: election.id,
        positionId: presidente!.id,
        number: '12',
        electoralName: 'BRIZOLA',
        name: 'Leonel de Moura Brizola',
        party: 'PDT',
        viceCandidateName: 'Darcy Ribeiro',
        isNational: true,
      },
      // Governador (2 dígitos, Nacional/Geral de teste)
      {
        electionId: election.id,
        positionId: governador!.id,
        number: '45',
        electoralName: 'MÁRIO COVAS',
        name: 'Mário Covas Júnior',
        party: 'PSDB',
        viceCandidateName: 'Geraldo Alckmin',
        isNational: true,
      },
      {
        electionId: election.id,
        positionId: governador!.id,
        number: '13',
        electoralName: 'JOSÉ DIRCEU',
        name: 'José Dirceu de Oliveira e Silva',
        party: 'PT',
        viceCandidateName: 'Luiz Eduardo Greenhalgh',
        isNational: true,
      },
      // Senador (3 dígitos, Nacional de teste)
      {
        electionId: election.id,
        positionId: senador!.id,
        number: '451',
        electoralName: 'JOSÉ SERRA',
        name: 'José Serra',
        party: 'PSDB',
        viceCandidateName: 'Pedro Piva (1º Suplente)',
        isNational: true,
      },
      {
        electionId: election.id,
        positionId: senador!.id,
        number: '131',
        electoralName: 'EDUARDO SUPLICY',
        name: 'Eduardo Matarazzo Suplicy',
        party: 'PT',
        viceCandidateName: 'Ana Maria Silveira (1ª Suplente)',
        isNational: true,
      },
      // Deputado Federal (4 dígitos, Nacional de teste)
      {
        electionId: election.id,
        positionId: depFederal!.id,
        number: '1313',
        electoralName: 'JOSÉ GENOINO',
        name: 'José Genoino Neto',
        party: 'PT',
        isNational: true,
      },
      {
        electionId: election.id,
        positionId: depFederal!.id,
        number: '4545',
        electoralName: 'ARNALDO MADEIRA',
        name: 'Arnaldo de Abreu Madeira',
        party: 'PSDB',
        isNational: true,
      },
      {
        electionId: election.id,
        positionId: depFederal!.id,
        number: '5656',
        electoralName: 'DRA. HANNELORE',
        name: 'Hannelore Roebeling',
        party: 'PRONA',
        isNational: true,
      },
    ];

    for (const cand of sampleCandidates) {
      const exists = await prisma.candidate.findFirst({
        where: { electionId: cand.electionId, positionId: cand.positionId, number: cand.number },
      });
      if (!exists) {
        await prisma.candidate.create({ data: cand });
      }
    }
    console.log(`✅ ${sampleCandidates.length} candidatos de exemplo cadastrados`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
