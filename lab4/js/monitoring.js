'use strict';

const noiseLevels = [
    42, 55, 61, 78, 83, 67, 49, 72, 91, 58, 64, 76,
    53, 47, 88, 69, 74, 82, 95, 51, 71, -1, 85, 63,
    79, 39, 141, 86
];

const warningLevel = 70;
const criticalLevel = 85;
const minValidLevel = 30;
const maxValidLevel = 130;

const statusLabel = value => `Рівень: ${value} dB`;

const isAbove = (value, threshold) => value > threshold;

function isValidLevel(level, min, max) {
    return Number.isFinite(level) && level >= min && level <= max;
}

const firstCriticalBeforeDeclaration = findFirstCritical(
    noiseLevels, criticalLevel, minValidLevel, maxValidLevel
);

function findFirstCritical(data, limit, min, max) {
    for (let i = 0; i < data.length; i++) {
        const level = data[i];
        if (!isValidLevel(level, min, max)) continue;
        if (level > limit) {
            return { level, position: i + 1 };
        }
    }
    return null;
}

const countByCategory = function (data, warning, critical, min, max) {
    const counts = { valid: 0, invalid: 0, safe: 0, warning: 0, critical: 0, sum: 0 };

    for (const level of data) {
        if (!isValidLevel(level, min, max)) {
            counts.invalid++;
            continue;
        }

        counts.valid++;
        counts.sum += level;
        if (level <= warning) {
            counts.safe++;
        } else if (level <= critical) {
            counts.warning++;
        } else {
            counts.critical++;
        }
    }
    return counts;
};

function runAnalysis(data, analyzer) {
    return analyzer(data, warningLevel, criticalLevel, minValidLevel, maxValidLevel);
}

function calculateAverage(data, min, max) {
    let sum = 0;
    let count = 0;
    for (const level of data) {
        if (!isValidLevel(level, min, max)) continue;
        sum += level;
        count++;
    }
    return count === 0 ? null : sum / count;
}

function findMinimum(data, min, max) {
    let result = null;
    for (const level of data) {
        if (!isValidLevel(level, min, max)) continue;
        if (result === null || level < result) result = level;
    }
    return result;
}

function findMaximum(data, min, max) {
    let result = null;
    for (const level of data) {
        if (!isValidLevel(level, min, max)) continue;
        if (result === null || level > result) result = level;
    }
    return result;
}

function findRecovery(data, firstCritical, warning, min, max) {
    if (firstCritical === null) return null;

    let index = firstCritical.position; 
    let consecutiveSafe = 0;
    let recoveryPosition = null;

    while (index < data.length) {
        const level = data[index];
        if (isValidLevel(level, min, max) && level <= warning) {
            consecutiveSafe++;
            if (consecutiveSafe === 3) {
                recoveryPosition = index + 1;
                break;
            }
        } else {
            consecutiveSafe = 0;
        }
        index++; 
    }
    return recoveryPosition;
}

function findFirstValid(data, min, max) {
    if (data.length === 0) return null;

    let index = 0;
    let level;
    do {
        level = data[index];
        if (isValidLevel(level, min, max)) return { level, position: index + 1 };
        index++;
    } while (index < data.length);

    return null;
}

function listInvalidMeasurements(data, min, max) {
    const invalid = [];
    for (let i = 0; i < data.length; i++) {
        if (!isValidLevel(data[i], min, max)) {
            invalid.push({ position: i + 1, level: data[i] });
        }
    }
    return invalid;
}

function printReport(data, label = 'Основний набір') {
    const counts = runAnalysis(data, countByCategory);
    const average = calculateAverage(data, minValidLevel, maxValidLevel);
    const minimum = findMinimum(data, minValidLevel, maxValidLevel);
    const maximum = findMaximum(data, minValidLevel, maxValidLevel);
    const firstCritical = findFirstCritical(data, criticalLevel, minValidLevel, maxValidLevel);
    const recoveryPosition = findRecovery(data, firstCritical, warningLevel, minValidLevel, maxValidLevel);
    const firstValid = findFirstValid(data, minValidLevel, maxValidLevel);
    const invalid = listInvalidMeasurements(data, minValidLevel, maxValidLevel);

    console.group(`Акустична варта — звіт моніторингу (${label})`);
    console.log(`Пороги: попередження > ${warningLevel} dB; критичний рівень > ${criticalLevel} dB`);
    console.log(`Усього вимірювань: ${data.length}`);
    console.log(`Коректних: ${counts.valid}`);
    console.log(`Некоректних: ${counts.invalid}`);
    console.table([
        { Категорія: 'Без перевищення', Кількість: counts.safe },
        { Категорія: 'Попередження', Кількість: counts.warning },
        { Категорія: 'Критичні', Кількість: counts.critical }
    ]);
    console.log(`Середній рівень: ${average === null ? 'немає даних' : `${average.toFixed(2)} dB`}`);
    console.log(`Мінімальний рівень: ${minimum === null ? 'немає даних' : `${minimum} dB`}`);
    console.log(`Максимальний рівень: ${maximum === null ? 'немає даних' : `${maximum} dB`}`);
    console.log(`Перше критичне вимірювання: ${firstCritical ? `${firstCritical.level} dB, позиція ${firstCritical.position}` : 'не знайдено'}`);
    console.log(`Відновлення — три безпечні вимірювання поспіль: ${recoveryPosition === null ? 'не знайдено' : `позиція ${recoveryPosition}`}`);
    console.log(`Перше коректне вимірювання: ${firstValid ? `${firstValid.level} dB, позиція ${firstValid.position}` : 'не знайдено'}`);

    const aboveWarning = counts.warning + counts.critical;
    if (aboveWarning > 0) {
        console.warn(`Поріг ${warningLevel} dB перевищено у ${aboveWarning} вимірюваннях.`);
    }
    if (invalid.length > 0) {
        console.error('Некоректні записи вхідних даних:', invalid.map(item => `позиція ${item.position} (${item.level} dB)`).join(', '));
    }

    if (counts.critical > 0) {
        console.log(`Висновок: зафіксовано ${counts.critical} критичні вимірювання; ${recoveryPosition === null ? 'після першого критичного стійкого відновлення не виявлено.' : `відновлення зафіксовано на позиції ${recoveryPosition}.`}`);
    } else {
        console.log('Висновок: критичних вимірювань не зафіксовано.');
    }
    console.groupEnd();

    return { counts, average, minimum, maximum, firstCritical, recoveryPosition };
}

printReport(noiseLevels);

console.group('Акустична варта — перевірка тестових наборів');
const emptyResult = printReport([], 'Порожній масив');
const invalidOnlyResult = printReport([-1, 141], 'Лише некоректні значення');
const boundaryResult = printReport([70, 85, 86], 'Перевірка меж категорій');
const interruptedSeriesResult = printReport([90, 60, 65, 72, 61, 62], 'Перервана серія безпечних значень');
console.groupEnd();

const describeLevels = data => data.map((value, index) => `${index + 1}. ${statusLabel(value)} — ${isAbove(value, warningLevel) ? 'вище порога' : 'у межах порога'}`);
console.group('Приклад Arrow Function та callback');
console.log(describeLevels([42, 70, 86]));
console.groupEnd();

