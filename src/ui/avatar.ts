import { GlobalVerdict } from '../core/types';

const moodStyles: Record<GlobalVerdict['mood'], string> = {
  штиль: 'avatar--calm',
  напряжение: 'avatar--tense',
  шторм: 'avatar--storm'
};

const rankStyles: Record<GlobalVerdict['rank'], string> = {
  S: 'avatar--rank-s',
  A: 'avatar--rank-a',
  B: 'avatar--rank-b',
  C: 'avatar--rank-c',
  D: 'avatar--rank-d'
};

const getMoodPhrase = (verdict: GlobalVerdict) => {
  if (verdict.mood === 'шторм') return 'Нужна стабилизация курса.';
  if (verdict.mood === 'напряжение') return 'Есть точки роста.';
  return 'Спокойное море и темп.';
};

const getAvatarFace = (verdict: GlobalVerdict) => {
  if (verdict.rank === 'S') return '😎';
  if (verdict.rank === 'A') return '🙂';
  if (verdict.rank === 'B') return '😐';
  if (verdict.rank === 'C') return '😟';
  return '😵‍💫';
};

export const createAvatar = (verdict: GlobalVerdict, level: number) => {
  const wrapper = document.createElement('div');
  wrapper.className = `avatar ${moodStyles[verdict.mood]} ${rankStyles[verdict.rank]}`;
  wrapper.innerHTML = `
    <span class="avatar-level">Lvl ${level}</span>
    <span class="avatar-face">${getAvatarFace(verdict)}</span>
    <span class="avatar-mark">Rank ${verdict.rank}</span>
    <span class="avatar-text">${verdict.mood}</span>
    <span class="avatar-phrase">${getMoodPhrase(verdict)}</span>
  `;
  return wrapper;
};
