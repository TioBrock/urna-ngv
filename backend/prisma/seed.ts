import 'dotenv/config';
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
    defaultVotingSystem: 'MAJORITARIO',
  },
  {
    name: 'Vice-Presidente',
    description: 'Vice-Presidente da República — Chapa conjunta com Presidente (2 dígitos)',
    scope: 'NACIONAL',
    isNational: true,
    defaultDigitCount: 2,
    defaultSlots: 1,
    defaultVotingSystem: 'MAJORITARIO',
  },
  {
    name: 'Governador',
    description: 'Governador do Estado — Chefe do Poder Executivo Estadual (2 dígitos)',
    scope: 'ESTADUAL',
    isNational: false,
    defaultDigitCount: 2,
    defaultSlots: 1,
    defaultVotingSystem: 'MAJORITARIO',
  },
  {
    name: 'Vice-Governador',
    description: 'Vice-Governador do Estado — Chapa conjunta com Governador (2 dígitos)',
    scope: 'ESTADUAL',
    isNational: false,
    defaultDigitCount: 2,
    defaultSlots: 1,
    defaultVotingSystem: 'MAJORITARIO',
  },
  {
    name: 'Senador',
    description: 'Senador — Representante do Estado no Congresso Nacional (3 dígitos)',
    scope: 'ESTADUAL',
    isNational: false,
    defaultDigitCount: 3,
    defaultSlots: 1,
    defaultVotingSystem: 'MAJORITARIO',
  },
  {
    name: 'Deputado Federal',
    description: 'Deputado Federal — Câmara dos Deputados eleito pelo Estado (4 dígitos)',
    scope: 'ESTADUAL',
    isNational: false,
    defaultDigitCount: 4,
    defaultSlots: 1,
    defaultVotingSystem: 'PROPORCIONAL',
  },
  {
    name: 'Deputado Estadual',
    description: 'Deputado Estadual — Assembleia Legislativa do Estado (5 dígitos)',
    scope: 'ESTADUAL',
    isNational: false,
    defaultDigitCount: 5,
    defaultSlots: 1,
    defaultVotingSystem: 'PROPORCIONAL',
  },
  {
    name: 'Prefeito',
    description: 'Prefeito Municipal — Chefe do Poder Executivo Municipal (2 dígitos)',
    scope: 'MUNICIPAL',
    isNational: false,
    defaultDigitCount: 2,
    defaultSlots: 1,
    defaultVotingSystem: 'MAJORITARIO',
  },
  {
    name: 'Vereador',
    description: 'Vereador — Câmara Municipal do Município (5 dígitos)',
    scope: 'MUNICIPAL',
    isNational: false,
    defaultDigitCount: 5,
    defaultSlots: 1,
    defaultVotingSystem: 'PROPORCIONAL',
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
        defaultVotingSystem: position.defaultVotingSystem,
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
        validateIp: false,
      },
    });

    const allStates = await prisma.state.findMany();
    await prisma.electionState.createMany({
      data: allStates.map((s) => ({ electionId: election.id, stateId: s.id })),
    });

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
            slots: 3,
            digitCount: 4,
            isNational: false,
            votingSystem: 'PROPORCIONAL',
          },
          {
            electionId: election.id,
            positionId: senador.id,
            order: 2,
            slots: 2,
            digitCount: 3,
            isNational: false,
            votingSystem: 'MAJORITARIO',
          },
          {
            electionId: election.id,
            positionId: governador.id,
            order: 3,
            slots: 1,
            digitCount: 2,
            isNational: false,
            votingSystem: 'MAJORITARIO',
          },
          {
            electionId: election.id,
            positionId: presidente.id,
            order: 4,
            slots: 1,
            digitCount: 2,
            isNational: true,
            votingSystem: 'MAJORITARIO',
          },
        ],
      });
    }

    console.log(`✅ Eleição de exemplo criada: Eleições Gerais 1994`);
  } else {
    console.log(`ℹ️  Eleição de exemplo já existe`);
  }

  // Busca a eleição com todas as relações para gerar votos
  const election = await prisma.election.findFirst({
    where: { name: 'Eleições Gerais 1994' },
    include: {
      electionPositions: { include: { position: true } },
      electionStates: { include: { state: true } },
    },
  });

  if (!election) {
    console.log('❌ Eleição não encontrada após criação');
    return;
  }

  // Garante status CLOSED e validateIp=false para testes
  await prisma.election.update({
    where: { id: election.id },
    data: { status: ElectionStatus.CLOSED, validateIp: false },
  });

  const presidente = await prisma.position.findFirst({ where: { name: 'Presidente' } });
  const governador = await prisma.position.findFirst({ where: { name: 'Governador' } });
  const senador = await prisma.position.findFirst({ where: { name: 'Senador' } });
  const depFederal = await prisma.position.findFirst({ where: { name: 'Deputado Federal' } });

  if (depFederal) {
    await prisma.electionPosition.updateMany({
      where: { electionId: election.id, positionId: depFederal.id },
      data: { slots: 3, votingSystem: 'PROPORCIONAL' },
    });
  }
  if (senador) {
    await prisma.electionPosition.updateMany({
      where: { electionId: election.id, positionId: senador.id },
      data: { slots: 2, votingSystem: 'MAJORITARIO' },
    });
  }

  const sampleCandidates = [
    // Presidente — Majoritário 1 vaga
    { electionId: election.id, positionId: presidente!.id, number: '45', electoralName: 'FERNANDO HENRIQUE CARDOSO', name: 'Fernando Henrique Cardoso (FHC)', party: 'PSDB', viceCandidateName: 'Marco Maciel', isNational: true },
    { electionId: election.id, positionId: presidente!.id, number: '13', electoralName: 'LULA', name: 'Luiz Inácio Lula da Silva', party: 'PT', viceCandidateName: 'Aloizio Mercadante', isNational: true },
    { electionId: election.id, positionId: presidente!.id, number: '56', electoralName: 'ENÉAS', name: 'Enéas Ferreira Carneiro', party: 'PRONA', viceCandidateName: 'Roberto Monteiro', isNational: true },
    { electionId: election.id, positionId: presidente!.id, number: '12', electoralName: 'BRIZOLA', name: 'Leonel de Moura Brizola', party: 'PDT', viceCandidateName: 'Darcy Ribeiro', isNational: true },
    // Governador — Majoritário 1 vaga
    { electionId: election.id, positionId: governador!.id, number: '45', electoralName: 'MÁRIO COVAS', name: 'Mário Covas Júnior', party: 'PSDB', viceCandidateName: 'Geraldo Alckmin', isNational: true },
    { electionId: election.id, positionId: governador!.id, number: '13', electoralName: 'JOSÉ DIRCEU', name: 'José Dirceu de Oliveira e Silva', party: 'PT', viceCandidateName: 'Luiz Eduardo Greenhalgh', isNational: true },
    // Senador — Majoritário 2 vagas
    { electionId: election.id, positionId: senador!.id, number: '451', electoralName: 'JOSÉ SERRA', name: 'José Serra', party: 'PSDB', viceCandidateName: 'Pedro Piva (1º Suplente)', isNational: true },
    { electionId: election.id, positionId: senador!.id, number: '131', electoralName: 'EDUARDO SUPLICY', name: 'Eduardo Matarazzo Suplicy', party: 'PT', viceCandidateName: 'Ana Maria Silveira (1ª Suplente)', isNational: true },
    { electionId: election.id, positionId: senador!.id, number: '120', electoralName: 'BENEDITA DA SILVA', name: 'Benedita da Silva', party: 'PT', viceCandidateName: 'Lindinalva Correa (1ª Suplente)', isNational: true },
    // Deputado Federal — Proporcional 3 vagas
    { electionId: election.id, positionId: depFederal!.id, number: '1313', electoralName: 'JOSÉ GENOINO', name: 'José Genoino Neto', party: 'PT', isNational: true },
    { electionId: election.id, positionId: depFederal!.id, number: '1314', electoralName: 'MARTA SUPLICY', name: 'Marta Teresa Smith de Vasconcellos Suplicy', party: 'PT', isNational: true },
    { electionId: election.id, positionId: depFederal!.id, number: '4545', electoralName: 'ARNALDO MADEIRA', name: 'Arnaldo de Abreu Madeira', party: 'PSDB', isNational: true },
    { electionId: election.id, positionId: depFederal!.id, number: '4546', electoralName: 'PAULO KOBAYASHI', name: 'Paulo Kobayashi', party: 'PSDB', isNational: true },
    { electionId: election.id, positionId: depFederal!.id, number: '5656', electoralName: 'DRA. HANNELORE', name: 'Hannelore Roebeling', party: 'PRONA', isNational: true },
  ];

  const candidateMap: Record<string, string> = {};
  for (const cand of sampleCandidates) {
    let existing = await prisma.candidate.findFirst({
      where: { electionId: cand.electionId, positionId: cand.positionId, number: cand.number },
    });
    if (!existing) {
      existing = await prisma.candidate.create({ data: cand });
    }
    candidateMap[`${cand.positionId}_${cand.number}`] = existing.id;
  }
  console.log(`✅ ${sampleCandidates.length} candidatos de exemplo cadastrados`);

  // ── Votos pré-computados ──
  const existingVotes = await prisma.vote.count({ where: { electionId: election.id } });
  if (existingVotes > 0) {
    console.log(`ℹ️  Votos já existem (${existingVotes}), pulando geração de votos de seed`);
  } else {
    console.log('🗳️  Gerando votos de teste pré-computados...');

    const spState = election.electionStates.find((es) => es.state.abbreviation === 'SP');
    const rjState = election.electionStates.find((es) => es.state.abbreviation === 'RJ');
    const mgState = election.electionStates.find((es) => es.state.abbreviation === 'MG');

    const epPresidente = election.electionPositions.find((ep) => ep.position.name === 'Presidente');
    const epSenador = election.electionPositions.find((ep) => ep.position.name === 'Senador');
    const epGovernador = election.electionPositions.find((ep) => ep.position.name === 'Governador');
    const epDepFederal = election.electionPositions.find((ep) => ep.position.name === 'Deputado Federal');

    if (!spState || !rjState || !mgState || !epPresidente || !epSenador || !epGovernador || !epDepFederal) {
      console.log('⚠️  Estados ou cargos não encontrados, pulando votos de seed');
    } else {
      const createVotedSession = async (
        stateId: string,
        discordName: string,
        ip: string,
        votes: Array<{ epId: string; slot: number; type: 'VALID' | 'BLANK' | 'NULL'; candidateId?: string }>
      ) => {
        const session = await prisma.voterSession.create({
          data: {
            electionId: election.id,
            stateId,
            discordName,
            rpgName: discordName,
            ip,
            status: 'VOTED',
            completedAt: new Date(),
            currentPositionOrder: 99,
          },
        });
        for (const v of votes) {
          await prisma.vote.create({
            data: {
              voterSessionId: session.id,
              electionId: election.id,
              electionPositionId: v.epId,
              stateId,
              slot: v.slot,
              type: v.type,
              candidateId: v.candidateId ?? null,
            },
          });
        }
      };

      const fhcId = candidateMap[`${presidente!.id}_45`];
      const lulaId = candidateMap[`${presidente!.id}_13`];
      const eneasId = candidateMap[`${presidente!.id}_56`];
      const brizolaId = candidateMap[`${presidente!.id}_12`];
      const covasId = candidateMap[`${governador!.id}_45`];
      const dirceuId = candidateMap[`${governador!.id}_13`];
      const serraId = candidateMap[`${senador!.id}_451`];
      const suplicyId = candidateMap[`${senador!.id}_131`];
      const beneditaId = candidateMap[`${senador!.id}_120`];
      const genoinoId = candidateMap[`${depFederal!.id}_1313`];
      const martaId = candidateMap[`${depFederal!.id}_1314`];
      const madeiraId = candidateMap[`${depFederal!.id}_4545`];
      const kobayashiId = candidateMap[`${depFederal!.id}_4546`];
      const hanneloreId = candidateMap[`${depFederal!.id}_5656`];

      // ── SP (20 eleitores) — FHC lidera, PT em segundo ──
      const spTemplates = [
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: madeiraId, dep2: kobayashiId, dep3: genoinoId },
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: madeiraId, dep2: genoinoId, dep3: martaId },
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: beneditaId, dep1: madeiraId, dep2: kobayashiId, dep3: hanneloreId },
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: kobayashiId, dep2: madeiraId, dep3: martaId },
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: madeiraId, dep2: kobayashiId, dep3: genoinoId },
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: genoinoId, dep2: martaId, dep3: madeiraId },
        { pres: lulaId, gov: dirceuId, sen1: suplicyId, sen2: beneditaId, dep1: genoinoId, dep2: martaId, dep3: madeiraId },
        { pres: lulaId, gov: dirceuId, sen1: suplicyId, sen2: serraId, dep1: genoinoId, dep2: martaId, dep3: hanneloreId },
        { pres: lulaId, gov: dirceuId, sen1: suplicyId, sen2: beneditaId, dep1: genoinoId, dep2: martaId, dep3: kobayashiId },
        { pres: lulaId, gov: dirceuId, sen1: suplicyId, sen2: serraId, dep1: martaId, dep2: genoinoId, dep3: madeiraId },
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: madeiraId, dep2: kobayashiId, dep3: genoinoId },
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: kobayashiId, dep2: madeiraId, dep3: martaId },
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: beneditaId, dep1: madeiraId, dep2: hanneloreId, dep3: kobayashiId },
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: madeiraId, dep2: kobayashiId, dep3: genoinoId },
        { pres: eneasId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: hanneloreId, dep2: madeiraId, dep3: kobayashiId },
        { pres: eneasId, gov: dirceuId, sen1: serraId, sen2: beneditaId, dep1: hanneloreId, dep2: genoinoId, dep3: martaId },
        { pres: brizolaId, gov: dirceuId, sen1: suplicyId, sen2: beneditaId, dep1: genoinoId, dep2: martaId, dep3: madeiraId },
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: madeiraId, dep2: kobayashiId, dep3: genoinoId },
        { pres: lulaId, gov: dirceuId, sen1: suplicyId, sen2: beneditaId, dep1: martaId, dep2: genoinoId, dep3: hanneloreId },
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: madeiraId, dep2: kobayashiId, dep3: genoinoId },
      ];
      for (let i = 0; i < spTemplates.length; i++) {
        const t = spTemplates[i];
        await createVotedSession(spState.stateId, `Eleitor_SP_${i + 1}`, `10.0.1.${i + 1}`, [
          { epId: epDepFederal.id, slot: 1, type: 'VALID', candidateId: t.dep1 },
          { epId: epDepFederal.id, slot: 2, type: 'VALID', candidateId: t.dep2 },
          { epId: epDepFederal.id, slot: 3, type: 'VALID', candidateId: t.dep3 },
          { epId: epSenador.id, slot: 1, type: 'VALID', candidateId: t.sen1 },
          { epId: epSenador.id, slot: 2, type: 'VALID', candidateId: t.sen2 },
          { epId: epGovernador.id, slot: 1, type: 'VALID', candidateId: t.gov },
          { epId: epPresidente.id, slot: 1, type: 'VALID', candidateId: t.pres },
        ]);
      }
      console.log(`✅ 20 sessões VOTED criadas para SP`);

      // ── RJ (12 eleitores) ──
      const rjTemplates = [
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: madeiraId, dep2: kobayashiId, dep3: genoinoId },
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: madeiraId, dep2: kobayashiId, dep3: genoinoId },
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: beneditaId, dep1: kobayashiId, dep2: madeiraId, dep3: hanneloreId },
        { pres: lulaId, gov: dirceuId, sen1: suplicyId, sen2: beneditaId, dep1: genoinoId, dep2: martaId, dep3: madeiraId },
        { pres: lulaId, gov: dirceuId, sen1: suplicyId, sen2: beneditaId, dep1: genoinoId, dep2: martaId, dep3: kobayashiId },
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: madeiraId, dep2: kobayashiId, dep3: genoinoId },
        { pres: eneasId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: hanneloreId, dep2: madeiraId, dep3: genoinoId },
        { pres: brizolaId, gov: dirceuId, sen1: suplicyId, sen2: beneditaId, dep1: martaId, dep2: genoinoId, dep3: hanneloreId },
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: madeiraId, dep2: kobayashiId, dep3: genoinoId },
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: kobayashiId, dep2: madeiraId, dep3: martaId },
        { pres: lulaId, gov: dirceuId, sen1: suplicyId, sen2: serraId, dep1: genoinoId, dep2: martaId, dep3: madeiraId },
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: madeiraId, dep2: kobayashiId, dep3: genoinoId },
      ];
      for (let i = 0; i < rjTemplates.length; i++) {
        const t = rjTemplates[i];
        await createVotedSession(rjState.stateId, `Eleitor_RJ_${i + 1}`, `10.0.2.${i + 1}`, [
          { epId: epDepFederal.id, slot: 1, type: 'VALID', candidateId: t.dep1 },
          { epId: epDepFederal.id, slot: 2, type: 'VALID', candidateId: t.dep2 },
          { epId: epDepFederal.id, slot: 3, type: 'VALID', candidateId: t.dep3 },
          { epId: epSenador.id, slot: 1, type: 'VALID', candidateId: t.sen1 },
          { epId: epSenador.id, slot: 2, type: 'VALID', candidateId: t.sen2 },
          { epId: epGovernador.id, slot: 1, type: 'VALID', candidateId: t.gov },
          { epId: epPresidente.id, slot: 1, type: 'VALID', candidateId: t.pres },
        ]);
      }
      console.log(`✅ 12 sessões VOTED criadas para RJ`);

      // ── MG (8 eleitores) ──
      const mgTemplates = [
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: madeiraId, dep2: kobayashiId, dep3: genoinoId },
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: madeiraId, dep2: genoinoId, dep3: kobayashiId },
        { pres: lulaId, gov: dirceuId, sen1: suplicyId, sen2: beneditaId, dep1: genoinoId, dep2: martaId, dep3: madeiraId },
        { pres: lulaId, gov: dirceuId, sen1: suplicyId, sen2: beneditaId, dep1: martaId, dep2: genoinoId, dep3: hanneloreId },
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: kobayashiId, dep2: madeiraId, dep3: genoinoId },
        { pres: eneasId, gov: covasId, sen1: serraId, sen2: suplicyId, dep1: hanneloreId, dep2: madeiraId, dep3: kobayashiId },
        { pres: fhcId, gov: covasId, sen1: serraId, sen2: beneditaId, dep1: madeiraId, dep2: kobayashiId, dep3: martaId },
        { pres: brizolaId, gov: dirceuId, sen1: suplicyId, sen2: serraId, dep1: genoinoId, dep2: hanneloreId, dep3: madeiraId },
      ];
      for (let i = 0; i < mgTemplates.length; i++) {
        const t = mgTemplates[i];
        await createVotedSession(mgState.stateId, `Eleitor_MG_${i + 1}`, `10.0.3.${i + 1}`, [
          { epId: epDepFederal.id, slot: 1, type: 'VALID', candidateId: t.dep1 },
          { epId: epDepFederal.id, slot: 2, type: 'VALID', candidateId: t.dep2 },
          { epId: epDepFederal.id, slot: 3, type: 'VALID', candidateId: t.dep3 },
          { epId: epSenador.id, slot: 1, type: 'VALID', candidateId: t.sen1 },
          { epId: epSenador.id, slot: 2, type: 'VALID', candidateId: t.sen2 },
          { epId: epGovernador.id, slot: 1, type: 'VALID', candidateId: t.gov },
          { epId: epPresidente.id, slot: 1, type: 'VALID', candidateId: t.pres },
        ]);
      }
      console.log(`✅ 8 sessões VOTED criadas para MG`);

      console.log('✅ Total: 40 sessões VOTED com votos pré-computados criados para testes');
    }
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
