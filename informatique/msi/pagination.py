from rest_framework.pagination import PageNumberPagination


class PaginationStandard(PageNumberPagination):
    """Pagination pour les listes qui grossissent en continu (documents, dépenses)."""

    page_size = 6
    page_size_query_param = 'page_size'
    max_page_size = 100
