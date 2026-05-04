from rest_framework import serializers

from .models import Candidate, Election, Voter


class ElectionSerializer(serializers.ModelSerializer):
    is_voting_open = serializers.BooleanField(read_only=True)
    has_started = serializers.BooleanField(read_only=True)
    state = serializers.CharField(read_only=True)

    class Meta:
        model = Election
        fields = [
            "id",
            "name",
            "description",
            "start_datetime",
            "end_datetime",
            "status",
            "state",
            "published_at",
            "created_at",
            "updated_at",
            "created_by",
            "is_voting_open",
            "has_started",
        ]
        read_only_fields = [
            "id",
            "status",
            "state",
            "published_at",
            "created_at",
            "updated_at",
            "created_by",
            "is_voting_open",
            "has_started",
        ]

    def validate(self, attrs):
        start = attrs.get("start_datetime", getattr(self.instance, "start_datetime", None))
        end = attrs.get("end_datetime", getattr(self.instance, "end_datetime", None))

        if start is None or end is None:
            return attrs

        if end <= start:
            raise serializers.ValidationError(
                {"end_datetime": "End must be after start."}
            )

        min_duration = 5 * 60
        if (end - start).total_seconds() < min_duration:
            raise serializers.ValidationError(
                {"end_datetime": "Voting period must be at least 5 minutes long."}
            )

        return attrs


class CandidateSerializer(serializers.ModelSerializer):
    """Serializer for Candidate.

    Inputs (write):
        first_name, last_name, student_number, alias, party, position, description

    Outputs (read):
        Same fields plus voter_id, full_name, email, election (id), created_at, updated_at.

    On create, the voter **must already exist** (CSV import, etc.). Submitted
    **first_name** and **last_name** must **exactly match** (after stripping
    whitespace) the linked ``User`` record for that ``student_number`` — names
    cannot be changed via this endpoint; fix voter data at source (CSV / admin).
    """

    voter_id = serializers.IntegerField(source="voter.pk", read_only=True)
    # Not on Candidate model — read path is built in to_representation from voter.user / voter.
    first_name = serializers.CharField(
        max_length=100, write_only=True, required=False
    )
    last_name = serializers.CharField(
        max_length=100, write_only=True, required=False
    )
    student_number = serializers.CharField(
        max_length=50, write_only=True, required=False
    )
    full_name = serializers.SerializerMethodField()
    email = serializers.EmailField(read_only=True)
    profile_photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Candidate
        fields = [
            "voter_id",
            "first_name",
            "last_name",
            "student_number",
            "full_name",
            "email",
            "alias",
            "party",
            "position",
            "description",
            "profile_photo_url",
            "election",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "voter_id",
            "full_name",
            "email",
            "profile_photo_url",
            "election",
            "created_at",
            "updated_at",
        ]

    def get_profile_photo_url(self, obj):
        photo = getattr(obj, "profile_photo", None)
        if not photo:
            return None
        request = self.context.get("request")
        url = photo.url
        if request:
            return request.build_absolute_uri(url)
        return url

    def get_full_name(self, obj):
        first = obj.voter.user.first_name or ""
        last = obj.voter.user.last_name or ""
        return f"{first} {last}".strip()

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["first_name"] = instance.voter.user.first_name
        rep["last_name"] = instance.voter.user.last_name
        rep["student_number"] = instance.voter.student_number
        rep["email"] = instance.voter.user.email
        return rep

    def validate_position(self, value):
        if not value:
            raise serializers.ValidationError("Position is required.")
        return value

    def create(self, validated_data):
        first_name = (validated_data.pop("first_name", None) or "").strip()
        last_name = (validated_data.pop("last_name", None) or "").strip()
        student_number = (validated_data.pop("student_number", None) or "").strip()

        if not first_name:
            raise serializers.ValidationError({"first_name": "First name is required."})
        if not last_name:
            raise serializers.ValidationError({"last_name": "Last name is required."})
        if not student_number:
            raise serializers.ValidationError(
                {"student_number": "Student number is required."}
            )

        voter = Voter.objects.filter(student_number=student_number).first()
        if voter is None:
            raise serializers.ValidationError(
                {
                    "student_number": (
                        "No voter with this student number. Import them via voter CSV "
                        "(or register them as a voter first), then add them as a candidate."
                    )
                }
            )

        user = voter.user
        stored_first = (user.first_name or "").strip()
        stored_last = (user.last_name or "").strip()
        if first_name != stored_first:
            raise serializers.ValidationError(
                {
                    "first_name": (
                        "Must exactly match the voter on file for this student number "
                        f"({stored_first!r}). Double-check the student number if this "
                        "looks wrong."
                    )
                }
            )
        if last_name != stored_last:
            raise serializers.ValidationError(
                {
                    "last_name": (
                        "Must exactly match the voter on file for this student number "
                        f"({stored_last!r}). Double-check the student number if this "
                        "looks wrong."
                    )
                }
            )

        election = validated_data.get("election")
        if election is None:
            raise serializers.ValidationError(
                {"election": "Election is required to register a candidate."}
            )
        if Candidate.objects.filter(voter=voter, election=election).exists():
            raise serializers.ValidationError(
                {
                    "student_number": (
                        "This voter is already a candidate for this election."
                    )
                }
            )

        return Candidate.objects.create(voter=voter, **validated_data)

    def update(self, instance, validated_data):
        voter = instance.voter
        user = voter.user

        first_name = validated_data.pop("first_name", serializers.empty)
        last_name = validated_data.pop("last_name", serializers.empty)
        student_number = validated_data.pop("student_number", serializers.empty)

        if student_number is not serializers.empty:
            sn = str(student_number).strip()
            if sn != voter.student_number:
                raise serializers.ValidationError(
                    {
                        "student_number": (
                            "Cannot change student number here; remove this candidate "
                            "and ensure voter records are correct first."
                        )
                    }
                )

        if first_name is not serializers.empty:
            fn = str(first_name).strip()
            stored_first = (user.first_name or "").strip()
            if fn != stored_first:
                raise serializers.ValidationError(
                    {
                        "first_name": (
                            "Must exactly match the voter on file "
                            f"({stored_first!r})."
                        )
                    }
                )

        if last_name is not serializers.empty:
            ln = str(last_name).strip()
            stored_last = (user.last_name or "").strip()
            if ln != stored_last:
                raise serializers.ValidationError(
                    {
                        "last_name": (
                            "Must exactly match the voter on file "
                            f"({stored_last!r})."
                        )
                    }
                )

        return super().update(instance, validated_data)


_MAX_DESCRIPTION_LEN = 4000
_MAX_PHOTO_BYTES = 2 * 1024 * 1024
_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


class CandidateSelfProfileUpdateSerializer(serializers.ModelSerializer):
    """PATCH /api/me/candidate-profile/ — alias, description, photo only."""

    remove_photo = serializers.BooleanField(write_only=True, required=False)

    class Meta:
        model = Candidate
        fields = ["alias", "description", "profile_photo", "remove_photo"]

    def validate_alias(self, value):
        if value is None:
            return ""
        text = str(value).strip()
        if len(text) > Candidate._meta.get_field("alias").max_length:
            raise serializers.ValidationError("Alias is too long.")
        return text

    def validate_description(self, value):
        if value is None:
            return ""
        text = str(value).strip()
        if len(text) > _MAX_DESCRIPTION_LEN:
            raise serializers.ValidationError(
                f"Statement must be at most {_MAX_DESCRIPTION_LEN} characters."
            )
        return text

    def validate_profile_photo(self, file):
        if file is None:
            return file
        if file.size > _MAX_PHOTO_BYTES:
            raise serializers.ValidationError(
                "Image must be 2 MB or smaller."
            )
        ctype = (getattr(file, "content_type", None) or "").lower()
        if ctype not in _ALLOWED_IMAGE_TYPES:
            name = (getattr(file, "name", "") or "").lower()
            if name.endswith((".jpg", ".jpeg")):
                ctype = "image/jpeg"
            elif name.endswith(".png"):
                ctype = "image/png"
            elif name.endswith(".webp"):
                ctype = "image/webp"
        if ctype not in _ALLOWED_IMAGE_TYPES:
            raise serializers.ValidationError(
                "Use JPG, PNG, or WebP."
            )
        return file

    def update(self, instance, validated_data):
        remove = bool(validated_data.pop("remove_photo", False))
        new_photo = validated_data.get("profile_photo")
        if remove:
            if instance.profile_photo:
                instance.profile_photo.delete(save=False)
            instance.profile_photo = None
        elif new_photo is not None and instance.profile_photo:
            instance.profile_photo.delete(save=False)
        return super().update(instance, validated_data)
