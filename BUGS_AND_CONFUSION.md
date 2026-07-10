# Bugs And Confusion

## User Employee Create - Role Mapping

### Bug

Creating a user from `src/pages/roleconfig/UserEmployeeTab.tsx` hits:

`POST /v1/api/user/add/userEmployee`

The backend returns:

```json
{
  "error": "could not execute statement [Column 'role_id' cannot be null] [insert into user_roles (created_by,created_date,role_id,tenant_id,updated_date,user_id) values (?,?,?,?,?,?)]; SQL [insert into user_roles (created_by,created_date,role_id,tenant_id,updated_date,user_id) values (?,?,?,?,?,?)]; constraint [null]"
}
```

### Current Frontend Behavior

The role checkbox selection is used to fill:

```json
"roleNames": ["selected role"],
"role": "selected role"
```

Temporary test fields were also added to send the selected role ID:

```json
"roleId": 3,
"roleIds": [3],
"permissions": [
  {
    "roleId": 3,
    "roleName": "selected role"
  }
]
```

### Confusion

Swagger shows:

```json
"roleNames": ["string"],
"role": "string",
"permissions": [
  {
    "roleId": 0,
    "roleName": "string"
  }
]
```

But the backend still inserts `null` into `user_roles.role_id`.

Need to confirm with backend whether role lookup expects:

- `roleNames` as `roleName`, for example `Tester`
- `roleNames` as `roleCode`, for example `TESTING`
- top-level `role`
- `permissions[].roleId`
- another field not shown in Swagger

### Next Check

Capture the final payload and backend response after the temporary `roleId`, `roleIds`, and `permissions[].roleId` fields are sent.
