from django.contrib import admin

from .models import Election


@admin.register(Election)
class ElectionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "status",
        "start_datetime",
        "end_datetime",
        "published_at",
        "created_by",
    )
    list_filter = ("status",)
    search_fields = ("name", "description")
    readonly_fields = ("created_at", "updated_at", "published_at")
