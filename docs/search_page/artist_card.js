document.querySelectorAll('.artist-card').forEach(card => {
    card.addEventListener('click', () => {
        window.location.href = '../artist_page/artist_page.html';
    });
});
