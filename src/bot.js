const TIME_ZONE = 'America/Chicago';

function getLocalDate(date) {
    return new Date(date.toLocaleString('en-US', { timeZone: TIME_ZONE }));
}

function formatDate(date) {
    return date.toLocaleString('en-US', {
        timeZone: TIME_ZONE,
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
    });
} 