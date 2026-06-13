import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from core.importers import CSVImporter
from core.models import Group, User, ImportBatch

g = Group.objects.first()
u = User.objects.first()

importer = CSVImporter(g, u, "Expenses Export.csv")

with open("../Expenses Export.csv", "rb") as f:
    importer.process_file(f)

print("Import completed successfully!")
