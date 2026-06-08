"""Single import surface that pulls in every model so ``Base.metadata`` is
complete. Used by Alembic's env.py (autogenerate / target_metadata) and by the
seed script. Import order is irrelevant — relationships use string targets.
"""
from app.core.database import Base  # noqa: F401

# Account & Authorization
from app.modules.auth import models as auth_models  # noqa: F401
# Pet & Health Records
from app.modules.pet import models as pet_models  # noqa: F401
# Booking & Service Execution
from app.modules.booking import models as booking_models  # noqa: F401
from app.modules.checkin import models as checkin_models  # noqa: F401
from app.modules.grooming import models as grooming_models  # noqa: F401
# Payment, Notification & Audit (internal)
from app.modules.payment import models as payment_models  # noqa: F401
from app.modules.notification import models as notification_models  # noqa: F401
from app.modules.audit import models as audit_models  # noqa: F401

__all__ = ["Base"]
