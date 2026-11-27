import os
import unittest
from unittest.mock import patch

os.environ.setdefault("SUPABASE_URL", "https://example.invalid")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "teste-local")

import worker


class GarantiaTest(unittest.TestCase):
    def test_timeout_no_estorno_parcial_preserva_entrega(self):
        pedido = {"id": 1, "nicho": "Oficinas", "regiao": "Campinas, SP",
                  "user_id": "teste", "estimativa": 10, "valor_centavos": 9700}
        with (patch.object(worker, "DEMO", False),
              patch.object(worker, "_raspar", return_value=[{"empresa": "Teste"}]),
              patch.object(worker, "http"),
              patch.object(worker, "_set") as gravar,
              patch.object(worker, "devolver", side_effect=TimeoutError) as estornar):
            with self.assertRaises(TimeoutError):
                worker.processar(pedido)
        gravar.assert_called_once()
        entrega = gravar.call_args.kwargs
        self.assertEqual(entrega["status"], "pronta")
        self.assertEqual(entrega["reembolso_status"], "pendente")
        self.assertEqual(entrega["reembolso_centavos"], 8730)
        estornar.assert_called_once_with(pedido, 8730, entrega["reembolso_motivo"])
