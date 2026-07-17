export type KnowledgeLevel = 1 | 2 | 3;

export type PlacementTopic =
  | "number_systems"
  | "logic_conditions"
  | "algorithms_structures";

export interface PlacementQuestion {
  id: string;
  topic: PlacementTopic;
  question: string;
  options: string[];
  correctAnswer: string;
}

export interface PlacementAnswer {
  questionId: string;
  topic: PlacementTopic;
  question: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export interface PlacementEvaluation {
  knowledgeLevel: KnowledgeLevel;
  score: number;
  correctAnswers: number;
  summary: string;
  topicBreakdown: Record<PlacementTopic, { level: KnowledgeLevel; comment: string }>;
  recommendations: string[];
  usedFallback: boolean;
}

export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  {
    id: "q1",
    topic: "number_systems",
    question: "Какое число идёт после 101 в двоичной системе?",
    options: ["102", "110", "111", "100"],
    correctAnswer: "110",
  },
  {
    id: "q2",
    topic: "number_systems",
    question: "Что значит кодировать информацию?",
    options: ["Спрятать её навсегда", "Записать её понятным компьютеру способом", "Удалить лишние данные"],
    correctAnswer: "Записать её понятным компьютеру способом",
  },
  {
    id: "q3",
    topic: "number_systems",
    question: "Как компьютер может хранить картинку?",
    options: ["Как набор цветов точек", "Только как звук", "Только как бумажный лист"],
    correctAnswer: "Как набор цветов точек",
  },
  {
    id: "q4",
    topic: "logic_conditions",
    question: "Что значит условие «И»?",
    options: ["Должны выполниться оба условия", "Достаточно одного условия", "Нужно всё отменить"],
    correctAnswer: "Должны выполниться оба условия",
  },
  {
    id: "q5",
    topic: "logic_conditions",
    question: "Что значит условие «ИЛИ»?",
    options: ["Достаточно одного условия", "Всегда нужен ключ", "Нельзя выбрать ответ"],
    correctAnswer: "Достаточно одного условия",
  },
  {
    id: "q6",
    topic: "logic_conditions",
    question: "Что значит условие «НЕ тревога»?",
    options: ["Тревога включена", "Тревоги нет", "Тревога стала громче"],
    correctAnswer: "Тревоги нет",
  },
  {
    id: "q7",
    topic: "logic_conditions",
    question: "Дверь откроется, если есть ключ И есть энергия. Что нужно?",
    options: ["Только ключ", "Только энергия", "Ключ и энергия вместе"],
    correctAnswer: "Ключ и энергия вместе",
  },
  {
    id: "q8",
    topic: "algorithms_structures",
    question: "Что такое алгоритм?",
    options: ["Случайный набор слов", "Понятный порядок команд", "Название робота"],
    correctAnswer: "Понятный порядок команд",
  },
  {
    id: "q9",
    topic: "algorithms_structures",
    question: "Почему важен порядок команд?",
    options: ["Команды выполняются по очереди", "Компьютер сам угадает порядок", "Порядок никогда не важен"],
    correctAnswer: "Команды выполняются по очереди",
  },
  {
    id: "q10",
    topic: "algorithms_structures",
    question: "Что делает команда «Повторить 3 раза»?",
    options: ["Выполняет действия три раза", "Пропускает все действия", "Удаляет программу"],
    correctAnswer: "Выполняет действия три раза",
  },
];

export const knowledgeLevelLabels: Record<KnowledgeLevel, string> = {
  1: "Юный стажёр станции",
  2: "Инженер-исследователь",
  3: "Главный космоинженер",
};

export function getFallbackPlacementEvaluation(answers: PlacementAnswer[]): PlacementEvaluation {
  const correctAnswers = answers.filter((answer) => answer.isCorrect).length;
  const knowledgeLevel: KnowledgeLevel =
    correctAnswers <= 4 ? 1 : correctAnswers <= 7 ? 2 : 3;

  const topicBreakdown = PLACEMENT_QUESTIONS.reduce((acc, question) => {
    if (acc[question.topic]) return acc;

    const topicAnswers = answers.filter((answer) => answer.topic === question.topic);
    const topicCorrect = topicAnswers.filter((answer) => answer.isCorrect).length;
    const topicLevel: KnowledgeLevel =
      topicCorrect <= Math.max(1, Math.floor(topicAnswers.length / 3))
        ? 1
        : topicCorrect < topicAnswers.length
        ? 2
        : 3;

    acc[question.topic] = {
      level: topicLevel,
      comment:
        topicLevel === 1
          ? "Эту тему игра поможет спокойно потренировать."
          : topicLevel === 2
          ? "База уже есть, дальше закрепим её заданиями."
          : "Тема получается уверенно, можно пробовать сложнее.",
    };
    return acc;
  }, {} as PlacementEvaluation["topicBreakdown"]);

  return {
    knowledgeLevel,
    score: correctAnswers * 10,
    correctAnswers,
    summary:
      knowledgeLevel === 1
        ? "Стартуем спокойно: игра поможет разобраться с основами и будет чаще подсказывать."
        : knowledgeLevel === 2
        ? "Ты хорошо понял базовые идеи. Дальше потренируем более хитрые условия и алгоритмы."
        : "Отличный старт. Можно двигаться быстрее и пробовать задания посложнее.",
    topicBreakdown,
    recommendations:
      knowledgeLevel === 1
        ? ["Не спеши: внимательно читай условия.", "Пробуй подсказки, когда задача кажется сложной."]
        : knowledgeLevel === 2
        ? ["Проверяй порядок команд.", "Обращай внимание на слова И, ИЛИ и НЕ."]
        : ["Пробуй проходить уровни с меньшим числом команд.", "Ищи повторяющиеся действия в алгоритмах."],
    usedFallback: true,
  };
}
